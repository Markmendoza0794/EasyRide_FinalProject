import pool from "../config/db.js";
import queueConfig from "../config/queueConfig.js";
import ValidationError from "../utils/ValidationError.js";

const getManilaDate = async (connection) => {
  const [rows] = await connection.execute(`
    SELECT DATE_FORMAT(
      DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR),
      '%Y-%m-%d'
    ) AS today
  `);

  return rows[0].today;
};

const nextDate = (date) => {
  const next = new Date(`${date}T00:00:00.000Z`);

  next.setUTCDate(next.getUTCDate() + 1);

  return next.toISOString().slice(0, 10);
};

const transaction = async (operation) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Prevent simultaneous queue operations from duplicating slots.
    const [locks] = await connection.execute(`
      SELECT id
      FROM dispatcher_queue_mutex
      WHERE id = 1
      FOR UPDATE
    `);

    if (!locks.length) {
      throw new ValidationError(
        503,
        "Queue database setup is incomplete."
      );
    }

    const result = await operation(connection);

    await connection.commit();

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const findAvailableSlot = async (connection, firstDate) => {
  let date = firstDate;

  for (;;) {
    await connection.execute(
      `
        INSERT IGNORE INTO dispatcher_queue_days (
          travel_date,
          allocated_count
        )
        VALUES (?, 0)
      `,
      [date]
    );

    const [days] = await connection.execute(
      `
        SELECT allocated_count
        FROM dispatcher_queue_days
        WHERE travel_date = ?
        FOR UPDATE
      `,
      [date]
    );

    const count = Number(days[0].allocated_count);

    if (count < queueConfig.dailyLimit) {
      await connection.execute(
        `
          UPDATE dispatcher_queue_days
          SET allocated_count = allocated_count + 1
          WHERE travel_date = ?
        `,
        [date]
      );

      return {
        travel_date: date,
        queue_number: count + 1,
      };
    }

    date = nextDate(date);
  }
};

const allocateConfirmedArrivals = async (dispatcherId) => {
  return transaction(async (connection) => {
    const today = await getManilaDate(connection);

    const [candidates] = await connection.execute(`
      SELECT
        arrival.id,
        arrival.driver_id
      FROM driver_active_arrivals AS active

      INNER JOIN driver_arrival_requests AS arrival
        ON arrival.id = active.request_id
        AND arrival.driver_id = active.driver_id

      LEFT JOIN dispatcher_queue_entries AS entry
        ON entry.request_id = arrival.id

      WHERE arrival.status = 'confirmed'
        AND entry.id IS NULL

      ORDER BY arrival.requested_at ASC, arrival.id ASC
    `);

    const allocations = [];

    for (const candidate of candidates) {
      await connection.execute(
        "SELECT id FROM drivers WHERE id = ? FOR UPDATE",
        [candidate.driver_id]
      );

      const [requests] = await connection.execute(
        `
          SELECT id, status
          FROM driver_arrival_requests
          WHERE id = ?
          FOR UPDATE
        `,
        [candidate.id]
      );

      const [active] = await connection.execute(
        `
          SELECT request_id
          FROM driver_active_arrivals
          WHERE driver_id = ?
          FOR UPDATE
        `,
        [candidate.driver_id]
      );

      if (
        requests[0]?.status !== "confirmed" ||
        Number(active[0]?.request_id) !== Number(candidate.id)
      ) {
        continue;
      }

      const [existing] = await connection.execute(
        `
          SELECT id
          FROM dispatcher_queue_entries
          WHERE request_id = ?
        `,
        [candidate.id]
      );

      if (existing.length) continue;

      const [activeQueue] = await connection.execute(
        `
          SELECT queue_id
          FROM driver_active_queues
          WHERE driver_id = ?
          FOR UPDATE
        `,
        [candidate.driver_id]
      );

      if (activeQueue.length) {
        throw new ValidationError(
          409,
          "This driver already has an active queue entry."
        );
      }

      const slot = await findAvailableSlot(connection, today);

      const [inserted] = await connection.execute(
        `
          INSERT INTO dispatcher_queue_entries (
            request_id,
            driver_id,
            travel_date,
            queue_number,
            allocated_by,
            allocated_at
          )
          VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
        `,
        [
          candidate.id,
          candidate.driver_id,
          slot.travel_date,
          slot.queue_number,
          dispatcherId,
        ]
      );

      await connection.execute(
        `
          INSERT INTO driver_active_queues (
            driver_id,
            queue_id
          )
          VALUES (?, ?)
        `,
        [candidate.driver_id, inserted.insertId]
      );

      allocations.push({
        id: Number(inserted.insertId),
        request_id: Number(candidate.id),
        ...slot,
      });
    }

    return {
      allocations,
      today,
      daily_limit: queueConfig.dailyLimit,
    };
  });
};

const changeTripStatus = async (
  queueId,
  dispatcherId,
  action
) => {
  return transaction(async (connection) => {
    const today = await getManilaDate(connection);

    const [rows] = await connection.execute(
      `
        SELECT driver_id, request_id
        FROM dispatcher_queue_entries
        WHERE id = ?
      `,
      [queueId]
    );

    if (!rows.length) {
      throw new ValidationError(404, "Queue entry not found.");
    }

    const driverId = rows[0].driver_id;
    const requestId = rows[0].request_id;

    await connection.execute(
      "SELECT id FROM drivers WHERE id = ? FOR UPDATE",
      [driverId]
    );

    const [requests] = await connection.execute(
      `
        SELECT status
        FROM driver_arrival_requests
        WHERE id = ?
        FOR UPDATE
      `,
      [requestId]
    );

    const [activeArrival] = await connection.execute(
      `
        SELECT request_id
        FROM driver_active_arrivals
        WHERE driver_id = ?
        FOR UPDATE
      `,
      [driverId]
    );

    const [entries] = await connection.execute(
      `
        SELECT
          id,
          status,
          DATE_FORMAT(travel_date, '%Y-%m-%d') AS travel_date
        FROM dispatcher_queue_entries
        WHERE id = ?
        FOR UPDATE
      `,
      [queueId]
    );

    const entry = entries[0];

    const [activeQueue] = await connection.execute(
      `
        SELECT queue_id
        FROM driver_active_queues
        WHERE driver_id = ?
        FOR UPDATE
      `,
      [driverId]
    );

    if (
      requests[0]?.status !== "confirmed" ||
      Number(activeArrival[0]?.request_id) !== Number(requestId) ||
      Number(activeQueue[0]?.queue_id) !== Number(queueId)
    ) {
      throw new ValidationError(
        409,
        "This trip is no longer active. Refresh the queue."
      );
    }

    if (action === "depart") {
      if (entry.status !== "waiting") {
        throw new ValidationError(
          409,
          "Only a waiting trip can depart."
        );
      }

      if (entry.travel_date > today) {
        throw new ValidationError(
          409,
          "A future-date allocation cannot depart yet."
        );
      }

      const [first] = await connection.execute(
        `
          SELECT id
          FROM dispatcher_queue_entries
          WHERE status = 'waiting'
            AND travel_date <= ?
          ORDER BY travel_date ASC, queue_number ASC
          LIMIT 1
          FOR UPDATE
        `,
        [today]
      );

      if (Number(first[0]?.id) !== Number(queueId)) {
        throw new ValidationError(
          409,
          "FIFO applies: depart the first eligible waiting van."
        );
      }

      await connection.execute(
        `
          UPDATE dispatcher_queue_entries
          SET
            status = 'departed',
            departed_by = ?,
            departed_at = UTC_TIMESTAMP(3)
          WHERE id = ?
            AND status = 'waiting'
        `,
        [dispatcherId, queueId]
      );

      return {
        id: Number(queueId),
        status: "departed",
      };
    }

    if (action !== "complete") {
      throw new ValidationError(400, "Invalid trip action.");
    }

    if (entry.status !== "departed") {
      throw new ValidationError(
        409,
        "Only a departed trip can be completed."
      );
    }

    await connection.execute(
      `
        UPDATE dispatcher_queue_entries
        SET
          status = 'completed',
          completed_by = ?,
          completed_at = UTC_TIMESTAMP(3)
        WHERE id = ?
          AND status = 'departed'
      `,
      [dispatcherId, queueId]
    );

    await connection.execute(
      `
        UPDATE driver_arrival_requests
        SET
          status = 'completed',
          resolved_at = UTC_TIMESTAMP(3)
        WHERE id = ?
          AND status = 'confirmed'
      `,
      [requestId]
    );

    await connection.execute(
      `
        DELETE FROM driver_active_queues
        WHERE driver_id = ?
          AND queue_id = ?
      `,
      [driverId, queueId]
    );

    await connection.execute(
      `
        DELETE FROM driver_active_arrivals
        WHERE driver_id = ?
          AND request_id = ?
      `,
      [driverId, requestId]
    );

    // Completed trips still consume their daily allocation.
    // A returning van needs a new arrival and queue allocation.
    return {
      id: Number(queueId),
      status: "completed",
    };
  });
};

const getQueue = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const today = await getManilaDate(connection);

    const [rows] = await connection.execute(
      `
        SELECT
          entry.id,
          entry.request_id,
          entry.driver_id,
          driver.full_name,
          driver.plate_number,

          DATE_FORMAT(
            entry.travel_date,
            '%Y-%m-%d'
          ) AS travel_date,

          entry.queue_number,
          entry.status,

          DATE_FORMAT(
            entry.allocated_at,
            '%Y-%m-%dT%H:%i:%s.%fZ'
          ) AS allocated_at,

          DATE_FORMAT(
            entry.departed_at,
            '%Y-%m-%dT%H:%i:%s.%fZ'
          ) AS departed_at,

          DATE_FORMAT(
            entry.completed_at,
            '%Y-%m-%dT%H:%i:%s.%fZ'
          ) AS completed_at,

          CASE
            WHEN entry.status = 'waiting' THEN (
              SELECT COUNT(*)
              FROM dispatcher_queue_entries AS ahead
              WHERE ahead.status = 'waiting'
                AND ahead.travel_date = entry.travel_date
                AND ahead.queue_number <= entry.queue_number
            )
            ELSE NULL
          END AS queue_position

        FROM dispatcher_queue_entries AS entry

        INNER JOIN drivers AS driver
          ON driver.id = entry.driver_id

        WHERE entry.status IN ('waiting', 'departed')
          OR entry.travel_date = ?

        ORDER BY entry.travel_date ASC, entry.queue_number ASC
      `,
      [today]
    );

    const [days] = await connection.execute(
      `
        SELECT
          DATE_FORMAT(
            travel_date,
            '%Y-%m-%d'
          ) AS travel_date,
          allocated_count
        FROM dispatcher_queue_days
        WHERE travel_date >= ?
        ORDER BY travel_date ASC
      `,
      [today]
    );

    await connection.commit();

    const entries = rows.map((row) => ({
      ...row,
      id: Number(row.id),
      queue_number: Number(row.queue_number),
      queue_position:
        row.queue_position === null
          ? null
          : Number(row.queue_position),
    }));

    const first = entries.find(
      (entry) =>
        entry.status === "waiting" &&
        entry.travel_date <= today
    );

    return {
      today,
      daily_limit: queueConfig.dailyLimit,
      time_zone: queueConfig.timeZone,
      next_departure_id: first?.id ?? null,
      entries,
      days: days.map((day) => ({
        ...day,
        allocated_count: Number(day.allocated_count),
        remaining_slots: Math.max(
          0,
          queueConfig.dailyLimit - Number(day.allocated_count)
        ),
      })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  allocateConfirmedArrivals,
  changeTripStatus,
  getQueue,
};
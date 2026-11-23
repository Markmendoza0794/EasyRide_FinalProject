import pool from "../config/db.js";
import queueConfig from "../config/queueConfig.js";
import ValidationError from "../utils/ValidationError.js";

const getToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: queueConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const readBoarding = async (connection, queueId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        entry.id,
        entry.status,
        DATE_FORMAT(entry.travel_date, '%Y-%m-%d') AS travel_date,
        COALESCE(boarding.is_boarding, 0) AS is_boarding,
        COALESCE(boarding.revision, 0) AS revision,
        seats.passenger_capacity,
        (
          SELECT COUNT(*)
          FROM dispatcher_seat_assignments AS assignment
          WHERE assignment.queue_id = entry.id
        ) AS passenger_count
      FROM dispatcher_queue_entries AS entry
      LEFT JOIN dispatcher_trip_boarding AS boarding
        ON boarding.queue_id = entry.id
      LEFT JOIN dispatcher_trip_seats AS seats
        ON seats.queue_id = entry.id
      WHERE entry.id = ?
    `,
    [queueId]
  );

  if (!rows.length) {
    throw new ValidationError(404, "Trip not found.");
  }

  const row = rows[0];

  return {
    queue_id: Number(row.id),
    trip_status: row.status,
    travel_date: row.travel_date,
    is_boarding:
      row.status === "waiting" &&
      row.travel_date <= getToday() &&
      Number(row.is_boarding) === 1,
    revision: Number(row.revision),
    passenger_capacity: row.passenger_capacity === null
      ? null
      : Number(row.passenger_capacity),
    passenger_count: Number(row.passenger_count),
  };
};

const getBoarding = async (queueId) => {
  const connection = await pool.getConnection();

  try {
    return await readBoarding(connection, queueId);
  } finally {
    connection.release();
  }
};

const saveBoarding = async (
  queueId,
  dispatcherId,
  isBoarding,
  revision
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [mutex] = await connection.execute(
      "SELECT id FROM dispatcher_queue_mutex WHERE id = 1 FOR UPDATE"
    );

    if (!mutex.length) {
      throw new ValidationError(
        503,
        "Queue configuration is incomplete."
      );
    }

    const [entries] = await connection.execute(
      "SELECT id, status FROM dispatcher_queue_entries WHERE id = ? FOR UPDATE",
      [queueId]
    );

    if (!entries.length) {
      throw new ValidationError(404, "Trip not found.");
    }

    if (entries[0].status !== "waiting") {
      throw new ValidationError(
        409,
        "Boarding can only be changed for a waiting trip."
      );
    }

    const current = await readBoarding(connection, queueId);

    if (current.revision !== revision) {
      throw new ValidationError(
        409,
        "Boarding status changed. Refresh before trying again."
      );
    }

    if (isBoarding) {
      const [head] = await connection.execute(
        `
          SELECT id
          FROM dispatcher_queue_entries
          WHERE status = 'waiting'
            AND travel_date <= ?
          ORDER BY travel_date ASC, queue_number ASC
          LIMIT 1
          FOR UPDATE
        `,
        [getToday()]
      );

      if (!head.length || Number(head[0].id) !== queueId) {
        throw new ValidationError(
          409,
          "Only the first eligible van in the FIFO queue can start boarding."
        );
      }

      if (
        !Number.isInteger(current.passenger_capacity) ||
        current.passenger_capacity <= 0
      ) {
        throw new ValidationError(
          409,
          "Set passenger capacity before starting boarding."
        );
      }

      if (
        current.passenger_count < 0 ||
        current.passenger_count >= current.passenger_capacity
      ) {
        throw new ValidationError(
          409,
          "Boarding requires at least one available seat."
        );
      }
    }

    if (current.revision === 0) {
      await connection.execute(
        `
          INSERT INTO dispatcher_trip_boarding (
            queue_id, is_boarding, revision, updated_by, updated_at
          )
          VALUES (?, ?, 1, ?, UTC_TIMESTAMP(3))
        `,
        [queueId, isBoarding ? 1 : 0, dispatcherId]
      );
    } else {
      await connection.execute(
        `
          UPDATE dispatcher_trip_boarding
          SET is_boarding = ?,
              revision = revision + 1,
              updated_by = ?,
              updated_at = UTC_TIMESTAMP(3)
          WHERE queue_id = ?
        `,
        [isBoarding ? 1 : 0, dispatcherId, queueId]
      );
    }

    const result = await readBoarding(connection, queueId);
    await connection.commit();

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getVanAvailability = async () => {
  const today = getToday();

  const [rows] = await pool.execute(
    `
      SELECT
        entry.id,
        entry.queue_number,
        driver.plate_number,
        entry.status,
        DATE_FORMAT(entry.travel_date, '%Y-%m-%d') AS travel_date,
        DATE_FORMAT(
          entry.departed_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS departed_at,
        seats.passenger_capacity,
        DATE_FORMAT(
          seats.updated_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS updated_at,
        COALESCE(assignments.passenger_count, 0) AS passenger_count,
        COALESCE(boarding.is_boarding, 0) AS is_boarding
      FROM dispatcher_queue_entries AS entry
      INNER JOIN driver_active_queues AS active
        ON active.queue_id = entry.id
        AND active.driver_id = entry.driver_id
      INNER JOIN drivers AS driver
        ON driver.id = entry.driver_id
      LEFT JOIN dispatcher_trip_seats AS seats
        ON seats.queue_id = entry.id
      LEFT JOIN dispatcher_trip_boarding AS boarding
        ON boarding.queue_id = entry.id
      LEFT JOIN (
        SELECT queue_id, COUNT(*) AS passenger_count
        FROM dispatcher_seat_assignments
        GROUP BY queue_id
      ) AS assignments
        ON assignments.queue_id = entry.id
      WHERE entry.status IN ('waiting', 'departed')
      ORDER BY entry.travel_date ASC, entry.queue_number ASC
    `
  );

  const first = rows.find(
    (row) => row.status === "waiting" && row.travel_date <= today
  );

  const vans = rows.map((row) => {
    const capacity = row.passenger_capacity === null
      ? null
      : Number(row.passenger_capacity);

    const occupied = capacity === null
      ? null
      : Number(row.passenger_count);

    const validSeats =
      Number.isInteger(capacity) &&
      capacity > 0 &&
      Number.isInteger(occupied) &&
      occupied >= 0 &&
      occupied <= capacity;

    const available = validSeats ? capacity - occupied : null;

    let availability = "waiting";

    if (row.status === "departed") {
      availability = "departed";
    } else if (row.travel_date > today) {
      availability = "scheduled";
    } else if (!validSeats) {
      availability = "unavailable";
    } else if (available === 0) {
      availability = "full";
    } else if (
      Number(row.id) === Number(first?.id) &&
      Number(row.is_boarding) === 1
    ) {
      availability = "boarding";
    }

    return {
      id: Number(row.id),
      plate_number: row.plate_number,
      queue_number: Number(row.queue_number),
      travel_date: row.travel_date,
      status: row.status,
      availability,
      can_board: availability === "boarding",
      origin: "Balayan, Batangas",
      destination: "Pasay City",
      route_description: "Balayan to Pasay via CALAX",
      total_seats: capacity,
      occupied_seats: occupied,
      available_seats:
        row.status === "waiting" && row.travel_date <= today
          ? available
          : null,
      departed_at: row.departed_at,
      updated_at: row.updated_at,
    };
  });

  return {
    today,
    time_zone: queueConfig.timeZone,
    fetched_at: new Date().toISOString(),
    vans,
  };
};

export {
  getBoarding,
  saveBoarding,
  getVanAvailability,
};

import pool from "../config/db.js";
import ValidationError from "../utils/ValidationError.js";

const requireInteger = (value, minimum, maximum, label) => {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ValidationError(400, `${label} is invalid.`);
  }
};

const readSeats = async (connection, queueId) => {
  const [trips] = await connection.execute(
    `
      SELECT
        entry.id,
        entry.status,
        entry.queue_number,
        driver.plate_number,
        DATE_FORMAT(
          entry.travel_date,
          '%Y-%m-%d'
        ) AS travel_date
      FROM dispatcher_queue_entries AS entry
      INNER JOIN drivers AS driver
        ON driver.id = entry.driver_id
      WHERE entry.id = ?
    `,
    [queueId]
  );

  if (!trips.length) {
    throw new ValidationError(404, "Trip not found.");
  }

  const [settings] = await connection.execute(
    `
      SELECT
        passenger_capacity,
        revision,
        DATE_FORMAT(
          updated_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS updated_at
      FROM dispatcher_trip_seats
      WHERE queue_id = ?
    `,
    [queueId]
  );

  const [assignments] = await connection.execute(
    `
      SELECT seat_number
      FROM dispatcher_seat_assignments
      WHERE queue_id = ?
      ORDER BY seat_number
    `,
    [queueId]
  );

  const capacity = settings.length
    ? Number(settings[0].passenger_capacity)
    : null;

  const occupiedSeats = assignments.map(
    (row) => Number(row.seat_number)
  );

  return {
    queue_id: Number(trips[0].id),
    queue_number: Number(trips[0].queue_number),
    plate_number: trips[0].plate_number,
    travel_date: trips[0].travel_date,
    trip_status: trips[0].status,
    passenger_capacity: capacity,
    occupied_seats: occupiedSeats,
    occupied_count: occupiedSeats.length,
    available_seats:
      capacity === null
        ? null
        : capacity - occupiedSeats.length,
    revision: settings.length
      ? Number(settings[0].revision)
      : 0,
    updated_at: settings[0]?.updated_at ?? null,
  };
};

const withTrip = async (queueId, writing, operation) => {
  requireInteger(queueId, 1, 2147483647, "Trip ID");

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (writing) {
      // Share the queue lock with departure and completion.
      const [locks] = await connection.execute(
        `
          SELECT id
          FROM dispatcher_queue_mutex
          WHERE id = 1
          FOR UPDATE
        `
      );

      if (!locks.length) {
        throw new ValidationError(
          503,
          "Queue database setup is incomplete."
        );
      }

      const [entries] = await connection.execute(
        `
          SELECT status
          FROM dispatcher_queue_entries
          WHERE id = ?
          FOR UPDATE
        `,
        [queueId]
      );

      if (!entries.length) {
        throw new ValidationError(404, "Trip not found.");
      }

      if (entries[0].status !== "waiting") {
        throw new ValidationError(
          409,
          "Passenger records can only be changed while the trip is waiting."
        );
      }
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

const checkRevision = (current, revision) => {
  requireInteger(revision, 0, 4294967294, "Revision");

  if (current.revision !== revision) {
    throw new ValidationError(
      409,
      "Passenger information changed. Refresh before trying again."
    );
  }
};

const getTripSeats = async (queueId) => {
  return withTrip(
    queueId,
    false,
    (connection) => readSeats(connection, queueId)
  );
};

const setTripCapacity = async (
  queueId,
  dispatcherId,
  capacity,
  revision
) => {
  requireInteger(
    dispatcherId,
    1,
    2147483647,
    "Dispatcher ID"
  );

  requireInteger(
    capacity,
    1,
    65535,
    "Passenger capacity"
  );

  return withTrip(queueId, true, async (connection) => {
    const current = await readSeats(connection, queueId);

    checkRevision(current, revision);

    if (current.occupied_count > capacity) {
      throw new ValidationError(
        409,
        "Passenger capacity cannot be lower than the recorded passenger count."
      );
    }

    if (current.passenger_capacity === null) {
      await connection.execute(
        `
          INSERT INTO dispatcher_trip_seats (
            queue_id,
            passenger_capacity,
            revision,
            updated_by,
            updated_at
          )
          VALUES (?, ?, 1, ?, UTC_TIMESTAMP(3))
        `,
        [queueId, capacity, dispatcherId]
      );
    } else {
      await connection.execute(
        `
          UPDATE dispatcher_trip_seats
          SET
            passenger_capacity = ?,
            revision = revision + 1,
            updated_by = ?,
            updated_at = UTC_TIMESTAMP(3)
          WHERE queue_id = ?
        `,
        [capacity, dispatcherId, queueId]
      );
    }

    return readSeats(connection, queueId);
  });
};

const changeSeatAssignment = async (
  queueId,
  dispatcherId,
  occupiedCount,
  revision
) => {
  requireInteger(
    dispatcherId,
    1,
    2147483647,
    "Dispatcher ID"
  );

  requireInteger(
    occupiedCount,
    0,
    65535,
    "Passenger count"
  );

  return withTrip(queueId, true, async (connection) => {
    const current = await readSeats(connection, queueId);

    checkRevision(current, revision);

    if (current.passenger_capacity === null) {
      throw new ValidationError(
        409,
        "Set the passenger capacity first."
      );
    }

    if (occupiedCount > current.passenger_capacity) {
      throw new ValidationError(
        400,
        "Passenger count cannot exceed passenger capacity."
      );
    }

    // Replace the total instead of adding it again.
    await connection.execute(
      `
        DELETE FROM dispatcher_seat_assignments
        WHERE queue_id = ?
      `,
      [queueId]
    );

    // Internal slot records represent the passenger count.
    for (
      let start = 1;
      start <= occupiedCount;
      start += 100
    ) {
      const size = Math.min(
        100,
        occupiedCount - start + 1
      );

      const placeholders = Array(size)
        .fill("(?, ?, ?, UTC_TIMESTAMP(3))")
        .join(", ");

      const values = [];

      for (let offset = 0; offset < size; offset += 1) {
        values.push(
          queueId,
          start + offset,
          dispatcherId
        );
      }

      await connection.execute(
        `
          INSERT INTO dispatcher_seat_assignments (
            queue_id,
            seat_number,
            recorded_by,
            recorded_at
          )
          VALUES ${placeholders}
        `,
        values
      );
    }

    await connection.execute(
      `
        UPDATE dispatcher_trip_seats
        SET
          revision = revision + 1,
          updated_by = ?,
          updated_at = UTC_TIMESTAMP(3)
        WHERE queue_id = ?
      `,
      [dispatcherId, queueId]
    );

    return readSeats(connection, queueId);
  });
};

export {
  getTripSeats,
  setTripCapacity,
  changeSeatAssignment,
};
import pool from "../config/db.js";
import ValidationError from "../utils/ValidationError.js";

const routeDetails = Object.freeze({
  origin: "Balayan, Batangas",
  destination: "Pasay City",
  route_description: "Balayan to Pasay via CALAX",
});

const requireInteger = (value, minimum, maximum, label) => {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ValidationError(400, `${label} is invalid.`);
  }
};

const readEta = async (connection, queueId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        entry.id,
        entry.status,
        entry.queue_number,
        eta.origin,
        eta.destination,
        eta.route_description,
        eta.estimated_duration_minutes,
        eta.revision,

        DATE_FORMAT(
          entry.departed_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS departed_at,

        DATE_FORMAT(
          eta.updated_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS updated_at,

        DATE_FORMAT(
          DATE_ADD(
            entry.departed_at,
            INTERVAL eta.estimated_duration_minutes MINUTE
          ),
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS estimated_arrival_at,

        DATE_FORMAT(
          UTC_TIMESTAMP(3),
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS retrieved_at

      FROM dispatcher_queue_entries AS entry

      LEFT JOIN dispatcher_trip_eta AS eta
        ON eta.queue_id = entry.id

      WHERE entry.id = ?
    `,
    [queueId]
  );

  if (!rows.length) {
    throw new ValidationError(404, "Trip not found.");
  }

  const row = rows[0];

  const duration =
    row.estimated_duration_minutes === null
      ? null
      : Number(row.estimated_duration_minutes);

  let status = "unavailable";
  let reason = "Enter an estimated travel duration.";

  if (row.status === "completed") {
    status = "inactive";
    reason =
      "This trip is completed. Its estimate is no longer active.";
  } else if (row.status === "waiting") {
    reason =
      duration === null
        ? "Enter an estimated travel duration. ETA becomes available after departure."
        : "ETA becomes available after departure is recorded.";
  } else if (
    duration !== null &&
    row.departed_at &&
    row.estimated_arrival_at
  ) {
    status =
      Date.parse(row.retrieved_at) >=
      Date.parse(row.estimated_arrival_at)
        ? "outdated"
        : "estimated";

    reason =
      status === "outdated"
        ? "The estimated arrival time has passed. Review the travel duration; arrival is not confirmed."
        : "Estimate based on recorded departure and dispatcher-entered travel duration.";
  }

  return {
    queue_id: Number(row.id),
    queue_number: Number(row.queue_number),
    trip_status: row.status,
    origin: row.origin ?? routeDetails.origin,
    destination: row.destination ?? routeDetails.destination,
    route_description:
      row.route_description ?? routeDetails.route_description,
    estimated_duration_minutes: duration,
    revision:
      row.revision === null ? 0 : Number(row.revision),
    departed_at: row.departed_at,
    updated_at: row.updated_at,
    estimated_arrival_at: row.estimated_arrival_at,
    calculated_at:
      row.estimated_arrival_at ? row.retrieved_at : null,
    retrieved_at: row.retrieved_at,
    status,
    reason,
    method:
      "Recorded departure plus dispatcher-entered travel duration",
    time_zone: "Asia/Manila",
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

      if (
        !["waiting", "departed"].includes(entries[0].status)
      ) {
        throw new ValidationError(
          409,
          "ETA settings cannot be changed for a completed trip."
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

const getTripEta = async (queueId) => {
  return withTrip(
    queueId,
    false,
    (connection) => readEta(connection, queueId)
  );
};

const saveTripEta = async (
  queueId,
  dispatcherId,
  duration,
  revision
) => {
  requireInteger(
    dispatcherId,
    1,
    2147483647,
    "Dispatcher ID"
  );

  requireInteger(
    duration,
    1,
    65535,
    "Estimated duration in minutes"
  );

  requireInteger(revision, 0, 4294967294, "Revision");

  return withTrip(queueId, true, async (connection) => {
    const current = await readEta(connection, queueId);

    if (current.revision !== revision) {
      throw new ValidationError(
        409,
        "ETA settings changed. Refresh before trying again."
      );
    }

    if (current.revision === 0) {
      await connection.execute(
        `
          INSERT INTO dispatcher_trip_eta (
            queue_id,
            origin,
            destination,
            route_description,
            estimated_duration_minutes,
            revision,
            updated_by,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, 1, ?, UTC_TIMESTAMP(3))
        `,
        [
          queueId,
          routeDetails.origin,
          routeDetails.destination,
          routeDetails.route_description,
          duration,
          dispatcherId,
        ]
      );
    } else {
      await connection.execute(
        `
          UPDATE dispatcher_trip_eta
          SET
            estimated_duration_minutes = ?,
            revision = revision + 1,
            updated_by = ?,
            updated_at = UTC_TIMESTAMP(3)
          WHERE queue_id = ?
        `,
        [duration, dispatcherId, queueId]
      );
    }

    return readEta(connection, queueId);
  });
};

export {
  getTripEta,
  saveTripEta,
};
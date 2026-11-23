import pool from "../config/db.js";

const findDriverQueue = async (driverId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        arrival.id AS arrival_id,
        arrival.status AS arrival_status,
        queue.id AS queue_id,
        queue.queue_number,
        queue.status AS queue_status,

        DATE_FORMAT(
          queue.travel_date,
          '%Y-%m-%d'
        ) AS travel_date,

        DATE_FORMAT(
          DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR),
          '%Y-%m-%d'
        ) AS today,

        CASE
          WHEN queue.status = 'waiting' THEN (
            SELECT COUNT(*)
            FROM dispatcher_queue_entries AS earlier
            WHERE earlier.travel_date = queue.travel_date
              AND earlier.status = 'waiting'
              AND earlier.queue_number <= queue.queue_number
          )
          ELSE NULL
        END AS waiting_position,

        DATE_FORMAT(
          queue.allocated_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS allocated_at,

        DATE_FORMAT(
          queue.departed_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS departed_at,

        DATE_FORMAT(
          queue.completed_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS completed_at

      FROM (
        SELECT id, driver_id, status
        FROM driver_arrival_requests
        WHERE driver_id = ?
        ORDER BY requested_at DESC, id DESC
        LIMIT 1
      ) AS arrival

      LEFT JOIN dispatcher_queue_entries AS queue
        ON queue.request_id = arrival.id
        AND queue.driver_id = arrival.driver_id
    `,
    [driverId]
  );

  const row = rows[0];

  if (!row) {
    return {
      arrival_id: null,
      arrival_status: null,
      queue: null,
    };
  }

  return {
    arrival_id: Number(row.arrival_id),
    arrival_status: row.arrival_status,
    queue:
      row.queue_id == null
        ? null
        : {
            id: Number(row.queue_id),
            queue_number: Number(row.queue_number),
            status: row.queue_status,
            travel_date: row.travel_date,
            today: row.today,
            waiting_position:
              row.waiting_position == null
                ? null
                : Number(row.waiting_position),
            allocated_at: row.allocated_at,
            departed_at: row.departed_at,
            completed_at: row.completed_at,
          },
  };
};

export { findDriverQueue };
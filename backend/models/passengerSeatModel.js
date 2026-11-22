import pool from "../config/db.js";
import queueConfig from "../config/queueConfig.js";

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

const getSeatAvailability = async () => {
  const today = getToday();

  const [rows] = await pool.execute(
    `
      SELECT
        entry.id,
        driver.plate_number,
        entry.queue_number,
        DATE_FORMAT(entry.travel_date, '%Y-%m-%d') AS travel_date,
        entry.status,
        seats.passenger_capacity,
        COALESCE(assignments.passenger_count, 0) AS passenger_count,
        DATE_FORMAT(
          seats.updated_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS updated_at
      FROM dispatcher_queue_entries AS entry
      INNER JOIN driver_active_queues AS active
        ON active.queue_id = entry.id
        AND active.driver_id = entry.driver_id
      INNER JOIN drivers AS driver
        ON driver.id = entry.driver_id
      LEFT JOIN dispatcher_trip_seats AS seats
        ON seats.queue_id = entry.id
      LEFT JOIN (
        SELECT queue_id, COUNT(*) AS passenger_count
        FROM dispatcher_seat_assignments
        GROUP BY queue_id
      ) AS assignments
        ON assignments.queue_id = entry.id
      WHERE entry.status = 'waiting'
        AND entry.travel_date <= ?
      ORDER BY entry.travel_date ASC, entry.queue_number ASC
    `,
    [today]
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

    return {
      id: Number(row.id),
      plate_number: row.plate_number,
      queue_number: Number(row.queue_number),
      travel_date: row.travel_date,
      status: row.status,
      total_seats: capacity,
      occupied_seats: occupied,
      available_seats: validSeats ? capacity - occupied : null,
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

export { getSeatAvailability };

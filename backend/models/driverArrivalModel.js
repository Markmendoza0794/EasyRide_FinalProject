import pool from "../config/db.js";
import ValidationError from "../utils/ValidationError.js";

const createPendingArrival = async (driverId, location) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Serialize arrival requests for the same driver.
    const [drivers] = await connection.execute(
      `
        SELECT id
        FROM drivers
        WHERE id = ?
        FOR UPDATE
      `,
      [driverId]
    );

    if (!drivers.length) {
      throw new ValidationError(
        401,
        "Please log in to your driver account."
      );
    }

    const [activeRequests] = await connection.execute(
      `
        SELECT request_id
        FROM driver_active_arrivals
        WHERE driver_id = ?
        FOR UPDATE
      `,
      [driverId]
    );

    if (activeRequests.length) {
      throw new ValidationError(
        409,
        "You already have an active arrival request."
      );
    }

    const recordedAt = new Date(
      location.location_recorded_at
    )
      .toISOString()
      .slice(0, 23)
      .replace("T", " ");

    const [result] = await connection.execute(
      `
        INSERT INTO driver_arrival_requests (
          driver_id,
          status,
          latitude,
          longitude,
          accuracy_meters,
          distance_meters,
          location_recorded_at,
          requested_at
        )
        VALUES (
          ?,
          'pending',
          ?,
          ?,
          ?,
          ?,
          ?,
          UTC_TIMESTAMP(3)
        )
      `,
      [
        driverId,
        location.latitude,
        location.longitude,
        location.accuracy_meters,
        location.distance_meters,
        recordedAt,
      ]
    );

    await connection.execute(
      `
        INSERT INTO driver_active_arrivals (
          driver_id,
          request_id
        )
        VALUES (?, ?)
      `,
      [driverId, result.insertId]
    );

    await connection.commit();

    return result.insertId;
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      throw new ValidationError(
        409,
        "You already have an active arrival request."
      );
    }

    throw error;
  } finally {
    connection.release();
  }
};

const findLatestArrival = async (driverId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        arrival.id,
        arrival.driver_id,
        arrival.status,
        arrival.latitude,
        arrival.longitude,
        arrival.accuracy_meters,
        arrival.distance_meters,

        DATE_FORMAT(
          arrival.location_recorded_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS location_recorded_at,

        DATE_FORMAT(
          arrival.requested_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS requested_at,

        DATE_FORMAT(
          arrival.confirmed_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS confirmed_at,

        DATE_FORMAT(
          arrival.resolved_at,
          '%Y-%m-%dT%H:%i:%s.%fZ'
        ) AS resolved_at,

        active.request_id AS active_request_id

      FROM driver_arrival_requests AS arrival

      LEFT JOIN driver_active_arrivals AS active
        ON active.request_id = arrival.id
        AND active.driver_id = arrival.driver_id

      WHERE arrival.driver_id = ?

      ORDER BY arrival.requested_at DESC, arrival.id DESC
      LIMIT 1
    `,
    [driverId]
  );

  const arrival = rows[0];

  if (!arrival) return null;

  return {
    id: arrival.id,
    driver_id: arrival.driver_id,
    status: arrival.status,
    is_active: arrival.active_request_id !== null,
    latitude: Number(arrival.latitude),
    longitude: Number(arrival.longitude),
    accuracy_meters: Number(arrival.accuracy_meters),
    distance_meters: Number(arrival.distance_meters),
    location_recorded_at: arrival.location_recorded_at,
    requested_at: arrival.requested_at,
    confirmed_at: arrival.confirmed_at,
    resolved_at: arrival.resolved_at,
  };
};

export {
  createPendingArrival,
  findLatestArrival,
};
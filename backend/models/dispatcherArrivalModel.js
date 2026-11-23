import pool from "../config/db.js";
import terminalConfig from "../config/terminalConfig.js";
import calculateDistance from "../utils/calculateDistance.js";


const getTerminalPresence = (row) => {
  const checkedAt = new Date().toISOString();
  const result = (status, reason, distanceMeters = null) => ({
    status, reason, distance_meters: distanceMeters,
    checked_at: checkedAt,
    max_location_age_seconds: terminalConfig.maxLocationAgeSeconds,
  });

  if (!row.latest_recorded_at) {
    return result("unavailable", "No saved GPS reading.");
  }

  const timestamp = Date.parse(row.latest_recorded_at);
  const ageSeconds = (Date.parse(checkedAt) - timestamp) / 1000;
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) {
    return result("unavailable", "GPS timestamp is invalid.");
  }
  if (ageSeconds > terminalConfig.maxLocationAgeSeconds) {
    return result("unavailable", "Saved GPS reading is stale.");
  }

  const values = [row.latest_latitude, row.latest_longitude, row.latest_accuracy_meters];
  if (values.some((value) => value === null || value === undefined || value === "")) {
    return result("unavailable", "GPS information is incomplete.");
  }
  const [latitude, longitude, accuracy] = values.map(Number);
  if (![latitude, longitude, accuracy].every(Number.isFinite) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0) {
    return result("unavailable", "GPS information is invalid.");
  }
  if (accuracy > terminalConfig.maxAccuracyMeters) {
    return result("unavailable", "GPS accuracy is too low to determine terminal presence.");
  }

  const distance = calculateDistance(latitude, longitude, terminalConfig.latitude, terminalConfig.longitude);
  if (distance + accuracy <= terminalConfig.radiusMeters) {
    return result("inside", "GPS reading is within the configured terminal boundary.", distance);
  }
  if (distance - accuracy > terminalConfig.radiusMeters) {
    return result("outside", "GPS reading is outside the configured terminal boundary.", distance);
  }
  return result("unavailable", "GPS accuracy overlaps the terminal boundary.", distance);
};

const fetchActiveArrivals = async () => {
  const [rows] = await pool.execute(
    `
      SELECT
        arrival.id AS request_id,
        arrival.driver_id,
        arrival.status,

        driver.full_name,
        driver.plate_number,
        driver.contact_number,

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
        latest.latitude AS latest_latitude,
        latest.longitude AS latest_longitude,
        latest.accuracy_meters AS latest_accuracy_meters,
        DATE_FORMAT(latest.recorded_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS latest_recorded_at

      FROM driver_active_arrivals AS active

      INNER JOIN driver_arrival_requests AS arrival
        ON arrival.id = active.request_id
        AND arrival.driver_id = active.driver_id

      INNER JOIN drivers AS driver
        ON driver.id = arrival.driver_id

      LEFT JOIN driver_locations AS latest
        ON latest.driver_id = arrival.driver_id

      WHERE arrival.status IN ('pending', 'confirmed')

      ORDER BY arrival.requested_at ASC, arrival.id ASC
    `
  );

  return rows.map((row) => ({
    request_id: row.request_id,
    driver_id: row.driver_id,
    status: row.status,
    full_name: row.full_name,
    plate_number: row.plate_number,
    contact_number: row.contact_number,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracy_meters: Number(row.accuracy_meters),
    distance_meters: Number(row.distance_meters),
    location_recorded_at: row.location_recorded_at,
    requested_at: row.requested_at,
    confirmed_at: row.confirmed_at,
    terminal_presence: getTerminalPresence(row),
    latest_location: row.latest_recorded_at ? {
      latitude: Number(row.latest_latitude),
      longitude: Number(row.latest_longitude),
      accuracy_meters: Number(row.latest_accuracy_meters),
      recorded_at: row.latest_recorded_at,
    } : null,
  }));
};

export { fetchActiveArrivals };

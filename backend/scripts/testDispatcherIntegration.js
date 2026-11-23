import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import pool from "../config/db.js";
import terminalConfig from "../config/terminalConfig.js";

const originalConnection = pool.getConnection.bind(pool);
const database =
  `easyride_dispatcher_test_${Date.now()}_${randomInt(1000000)}`;
const password = "DispatcherTestOnly2026!";
const quote = (value) =>
  `\`${String(value).replaceAll("`", "``")}\``;

let server;
let baseUrl;
let passed = 0;

const check = (condition, message) => {
  if (!condition) throw new Error(message);

  passed += 1;
  console.log(`PASS ${passed}: ${message}`);
};

const testConnection = async () => {
  const connection = await originalConnection();

  try {
    await connection.query(`USE ${quote(database)}`);

    const [rows] = await connection.query(
      "SELECT DATABASE() AS name"
    );

    if (rows[0].name !== database) {
      throw new Error("Database isolation failed.");
    }

    return connection;
  } catch (error) {
    connection.release();
    throw error;
  }
};

const sql = async (statement, values = []) => {
  const connection = await testConnection();

  try {
    return await connection.execute(statement, values);
  } finally {
    connection.release();
  }
};

const request = async (
  actor,
  method,
  path,
  body,
  sendHeader = true
) => {
  const headers = { Accept: "application/json" };

  if (sendHeader) {
    headers["X-EasyRide-Request"] = "1";
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (actor?.cookies.size) {
    headers.Cookie = [...actor.cookies]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  const response = await fetch(baseUrl + path, {
    method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

  if (actor) {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const index = pair.indexOf("=");

      actor.cookies.set(
        pair.slice(0, index),
        pair.slice(index + 1)
      );
    }
  }

  const data = await response.json().catch(() => null);

  return { status: response.status, data };
};

const expect = async (
  status,
  actor,
  method,
  path,
  body,
  sendHeader = true
) => {
  const response = await request(
    actor,
    method,
    path,
    body,
    sendHeader
  );

  if (response.status !== status) {
    throw new Error(
      `${method} ${path}: expected ${status}, received ${response.status}. ${response.data?.message || ""}`
    );
  }

  return response.data;
};

const actor = () => ({ cookies: new Map() });

const dispatcherA = actor();
const dispatcherB = actor();
const driver = actor();

const setup = async () => {
  if (!/^easyride_dispatcher_test_\d+_\d+$/.test(database)) {
    throw new Error("Invalid test database name.");
  }

  const connection = await originalConnection();

  try {
    const [rows] = await connection.query(
      "SELECT DATABASE() AS name"
    );

    const source = rows[0].name;

    if (
      !source ||
      /^easyride_(queue|dispatcher)_test_/.test(source)
    ) {
      throw new Error(
        "Use the normal application database as the structure source."
      );
    }

    // Copy definitions only, never application records.
    await connection.query(
      `CREATE DATABASE ${quote(database)}
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_general_ci`
    );

    await connection.query(`USE ${quote(database)}`);

    const [selected] = await connection.query(
      "SELECT DATABASE() AS name"
    );

    if (selected[0].name !== database) {
      throw new Error("Database isolation failed.");
    }

    for (const table of [
      "drivers",
      "dispatchers",
      "driver_arrival_requests",
      "driver_active_arrivals",
      "driver_locations",
    ]) {
      await connection.query(
        `CREATE TABLE ${quote(database)}.${quote(table)}
         LIKE ${quote(source)}.${quote(table)}`
      );
    }

    const allowed = new Set([
      "dispatcher_queue_mutex",
      "dispatcher_queue_days",
      "dispatcher_queue_entries",
      "driver_active_queues",
      "dispatcher_trip_seats",
      "dispatcher_seat_assignments",
      "dispatcher_trip_eta",
    ]);

    const created = new Set();

    for (const filename of [
      "dispatcher_queue.sql",
      "dispatcher_seats.sql",
      "dispatcher_eta.sql",
    ]) {
      const text = await readFile(
        new URL(`../database/${filename}`, import.meta.url),
        "utf8"
      );

      for (const part of text.split(";")) {
        const statement = part
          .replace(/--[^\r\n]*/g, "")
          .trim();

        if (!statement || /^USE\s+/i.test(statement)) {
          continue;
        }

        const table = statement.match(
          /^CREATE TABLE IF NOT EXISTS\s+`?([a-z_]+)`?\s*\(/i
        )?.[1];

        const mutexSeed =
          /^INSERT IGNORE INTO dispatcher_queue_mutex\b/i.test(
            statement
          );

        if (
          statement.includes(".") ||
          (!allowed.has(table) && !mutexSeed)
        ) {
          throw new Error(
            `Unexpected SQL in ${filename}. No application SQL was executed.`
          );
        }

        await connection.query(statement);

        if (table) created.add(table);
      }
    }

    if (created.size !== allowed.size) {
      throw new Error(
        "A required test table definition is missing."
      );
    }

    const hash = await bcrypt.hash(password, 10);

    for (let id = 1; id <= 2; id += 1) {
      await connection.execute(
        `INSERT INTO dispatchers
           (id, full_name, username, password)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          `Test Dispatcher ${id}`,
          `integration_dispatcher_${id}`,
          hash,
        ]
      );

      await connection.execute(
        `INSERT INTO drivers (
           id, full_name, address, contact_number,
           plate_number, username, password
         )
         VALUES (?, ?, 'TEST ONLY', '09000000000', ?, ?, ?)`,
        [
          id,
          `Integration Driver ${id}`,
          `IT-${id}`,
          `integration_driver_${id}`,
          hash,
        ]
      );

      await connection.execute(
        `INSERT INTO driver_arrival_requests (
           id, driver_id, status, latitude, longitude,
           accuracy_meters, distance_meters,
           location_recorded_at, requested_at
         )
         VALUES (
           ?, ?, 'pending', ?, ?, 1, 0,
           UTC_TIMESTAMP(3),
           DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? SECOND)
         )`,
        [
          id,
          id,
          terminalConfig.latitude,
          terminalConfig.longitude,
          60 - id,
        ]
      );

      await connection.execute(
        `INSERT INTO driver_active_arrivals
           (driver_id, request_id)
         VALUES (?, ?)`,
        [id, id]
      );
    }
  } finally {
    connection.release();
  }

  // Redirect database calls in this test process only.
  pool.getConnection = testConnection;
  pool.execute = sql;

  pool.query = async (statement, values) => {
    const connection = await testConnection();

    try {
      return await connection.query(statement, values);
    } finally {
      connection.release();
    }
  };

  const [
    { default: driverRoutes },
    { default: dispatcherRoutes },
  ] = await Promise.all([
    import("../routes/driverRoutes.js"),
    import("../routes/dispatcherRoutes.js"),
  ]);

  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.use(
    session({
      name: "easyride.integration-test.sid",
      secret: randomBytes(48).toString("hex"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      },
    })
  );

  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.use("/driver", driverRoutes);
  app.use("/dispatcher", dispatcherRoutes);

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const status =
      error.statusCode || error.status || 500;

    if (status >= 500) {
      console.error("Test API error:", error.message);
    }

    return res.status(status).json({
      message: error.message,
    });
  });

  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;

  console.log(`ISOLATED TEST DATABASE: ${database}`);
  console.log(`TEMPORARY TEST API: ${baseUrl}`);
};

const run = async () => {
  await setup();

  for (const path of [
    "/dispatcher/arrivals",
    "/dispatcher/queue",
    "/dispatcher/queue/1/seats",
    "/dispatcher/queue/1/eta",
    "/driver/queue",
  ]) {
    await expect(401, null, "GET", path);
  }

  for (const path of [
    "/dispatcher/queue/allocate",
    "/dispatcher/queue/1/seats/capacity",
    "/dispatcher/queue/1/seats/assignment",
    "/dispatcher/queue/1/eta",
  ]) {
    await expect(401, null, "POST", path, {});
  }

  check(
    true,
    "Unauthenticated dispatcher and driver endpoints reject access."
  );

  await expect(
    403, null, "POST", "/dispatcher/login", {}, false
  );

  await expect(
    200, dispatcherA, "POST", "/dispatcher/login",
    { username: "integration_dispatcher_1", password }
  );

  await expect(
    200, dispatcherB, "POST", "/dispatcher/login",
    { username: "integration_dispatcher_2", password }
  );

  await expect(
    200, driver, "POST", "/driver/login",
    { username: "integration_driver_1", password }
  );

  for (const suffix of ["seats", "eta"]) {
    await expect(
      401, driver, "GET",
      `/dispatcher/queue/1/${suffix}`
    );
  }

  for (const suffix of [
    "seats/capacity",
    "seats/assignment",
    "eta",
  ]) {
    await expect(
      401, driver, "POST",
      `/dispatcher/queue/1/${suffix}`, {}
    );

    await expect(
      403, dispatcherA, "POST",
      `/dispatcher/queue/1/${suffix}`, {}, false
    );
  }

  await expect(
    401, dispatcherA, "GET", "/driver/queue"
  );

  check(
    true,
    "Seat and ETA endpoints enforce role access and the request header."
  );

  const arrival = async () => {
    const result = await expect(
      200, dispatcherA, "GET", "/dispatcher/arrivals"
    );

    const item = result.arrivals.find(
      (row) => Number(row.request_id) === 1
    );

    if (!item) {
      throw new Error("Expected monitoring fixture is missing.");
    }

    return item;
  };

  check(
    (await arrival()).terminal_presence.status === "unavailable",
    "Missing GPS is reported as unavailable."
  );

  await sql(
    `INSERT INTO driver_locations (
       driver_id, latitude, longitude,
       accuracy_meters, recorded_at
     )
     VALUES (1, ?, ?, 0, UTC_TIMESTAMP(3))`,
    [terminalConfig.latitude, terminalConfig.longitude]
  );

  check(
    (await arrival()).terminal_presence.status === "inside",
    "Fresh terminal coordinates are classified as inside. Diagnostic: " +
JSON.stringify({
  application_time: new Date().toISOString(),
  database_time: (await sql(
    "SELECT DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ') AS test_utc_timestamp"
  ))[0],
  terminal: terminalConfig,
  arrival: await arrival()
})
  );

  await sql(
    `UPDATE driver_locations
     SET latitude = 0, longitude = 0,
         recorded_at = UTC_TIMESTAMP(3)
     WHERE driver_id = 1`
  );

  const outside = await arrival();

  check(
    outside.terminal_presence.status === "outside" &&
      outside.status === "pending",
    "Outside GPS does not automatically change the reviewed arrival status."
  );

  await sql(
    `UPDATE driver_locations
     SET latitude = ?, longitude = ?,
         accuracy_meters = ?,
         recorded_at = UTC_TIMESTAMP(3)
     WHERE driver_id = 1`,
    [
      terminalConfig.latitude,
      terminalConfig.longitude,
      Number(terminalConfig.maxAccuracyMeters) + 1,
    ]
  );

  check(
    (await arrival()).terminal_presence.status === "unavailable",
    "Imprecise GPS is reported as unavailable."
  );

  await sql(
    `UPDATE driver_locations
     SET accuracy_meters = 0,
         recorded_at = DATE_SUB(
           UTC_TIMESTAMP(3), INTERVAL ? SECOND
         )
     WHERE driver_id = 1`,
    [Number(terminalConfig.maxLocationAgeSeconds) + 120]
  );

  check(
    (await arrival()).terminal_presence.status === "unavailable",
    "Stale GPS is reported as unavailable."
  );

  await sql(
    `UPDATE driver_locations
     SET recorded_at = UTC_TIMESTAMP(3)
     WHERE driver_id = 1`
  );

  await expect(
    400, dispatcherA, "POST",
    "/dispatcher/arrivals/1/review",
    {
      decision: "confirmed",
      terminalPresenceVerified: false,
    }
  );

  for (const id of [2, 1]) {
    await expect(
      200, dispatcherA, "POST",
      `/dispatcher/arrivals/${id}/review`,
      {
        decision: "confirmed",
        note: "Isolated test fixture only.",
        terminalPresenceVerified: true,
      }
    );
  }

  const batch = await expect(
    200, dispatcherA, "POST", "/dispatcher/queue/allocate"
  );

  check(
    batch.allocations.length === 2 &&
      Number(batch.allocations[0].request_id) === 1 &&
      Number(batch.allocations[1].request_id) === 2,
    "HTTP allocation preserves request-time FIFO despite reverse confirmation order."
  );

  const first = batch.allocations[0].id;
  const second = batch.allocations[1].id;

  const seatPath = `/dispatcher/queue/${first}/seats`;
  const etaPath = `/dispatcher/queue/${first}/eta`;

  const getSeats = async () =>
    (await expect(
      200, dispatcherA, "GET", seatPath
    )).seats;

  const getEta = async () =>
    (await expect(
      200, dispatcherA, "GET", etaPath
    )).eta;

  for (const path of [
    "/dispatcher/queue/invalid/seats",
    "/dispatcher/queue/invalid/eta",
  ]) {
    await expect(400, dispatcherA, "GET", path);
  }

  for (const path of [
    "/dispatcher/queue/2147483647/seats",
    "/dispatcher/queue/2147483647/eta",
  ]) {
    await expect(404, dispatcherA, "GET", path);
  }

  check(
    true,
    "Invalid and missing trip IDs return 400 and 404."
  );

  let seats = await getSeats();

  check(
    seats.passenger_capacity === null &&
      seats.available_seats === null,
    "Unset capacity is not presented as a known available-seat count."
  );

  for (const value of [0, -1, 1.5, "18", null]) {
    await expect(
      400, dispatcherA, "POST", seatPath + "/capacity",
      { passenger_capacity: value, revision: 0 }
    );
  }

  check(
    true,
    "Capacity rejects zero, negative, fractional, string, and null values."
  );

  seats = (await expect(
    200, dispatcherA, "POST", seatPath + "/capacity",
    { passenger_capacity: 18, revision: 0 }
  )).seats;

  seats = (await expect(
    200, dispatcherA, "POST", seatPath + "/assignment",
    { occupied_count: 0, revision: seats.revision }
  )).seats;

  check(
    seats.occupied_count === 0 &&
      seats.available_seats === 18,
    "An empty 18-seat trip has 18 available seats."
  );

  for (const value of [-1, 1.5, "5", null, 19]) {
    await expect(
      400, dispatcherA, "POST", seatPath + "/assignment",
      { occupied_count: value, revision: seats.revision }
    );
  }

  await expect(
    400, dispatcherA, "POST", seatPath + "/assignment",
    { occupied_count: 5 }
  );

  check(
    true,
    "Passenger counts and required revisions are validated by the API."
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    seats = (await expect(
      200, dispatcherA, "POST", seatPath + "/assignment",
      { occupied_count: 5, revision: seats.revision }
    )).seats;
  }

  check(
    seats.occupied_count === 5 &&
      seats.available_seats === 13,
    "Repeated saves replace the total without duplicating passengers."
  );

  seats = (await expect(
    200, dispatcherA, "POST", seatPath + "/assignment",
    { occupied_count: 18, revision: seats.revision }
  )).seats;

  check(
    seats.available_seats === 0,
    "A full trip has zero available seats."
  );

  await expect(
    409, dispatcherA, "POST", seatPath + "/capacity",
    { passenger_capacity: 17, revision: seats.revision }
  );

  await expect(
    409, dispatcherA, "POST", seatPath + "/assignment",
    { occupied_count: 1, revision: 0 }
  );

  check(
    true,
    "Capacity below occupancy and stale passenger revisions are rejected with 409."
  );

  seats = (await expect(
    200, dispatcherA, "POST", seatPath + "/assignment",
    { occupied_count: 5, revision: seats.revision }
  )).seats;

  const seatRace = await Promise.all([
    request(
      dispatcherA, "POST", seatPath + "/assignment",
      { occupied_count: 6, revision: seats.revision }
    ),
    request(
      dispatcherB, "POST", seatPath + "/assignment",
      { occupied_count: 7, revision: seats.revision }
    ),
  ]);

  const seatWinner = seatRace.find(
    (item) => item.status === 200
  )?.data?.seats;

  seats = await getSeats();

  check(
    seatRace.map((item) => item.status)
      .sort().join(",") === "200,409" &&
      seats.occupied_count === seatWinner?.occupied_count &&
      [6, 7].includes(seats.occupied_count) &&
      seats.available_seats === 18 - seats.occupied_count,
    "Two dispatchers updating one passenger revision produce one success and one conflict."
  );

  let eta = await getEta();

  check(
    eta.status === "unavailable" &&
      eta.estimated_duration_minutes === null,
    "Missing duration produces an unavailable ETA."
  );

  for (const value of [0, -1, 1.5, "180", null]) {
    await expect(
      400, dispatcherA, "POST", etaPath,
      { estimated_duration_minutes: value, revision: 0 }
    );
  }

  await expect(
    400, dispatcherA, "POST", etaPath,
    { estimated_duration_minutes: 180 }
  );

  check(
    true,
    "ETA duration types, range, and required revision are validated by the API."
  );

  eta = (await expect(
    200, dispatcherA, "POST", etaPath,
    { estimated_duration_minutes: 180, revision: 0 }
  )).eta;

  check(
    eta.status === "unavailable" &&
      eta.estimated_arrival_at === null,
    "Saved duration does not invent a departure time."
  );

  const etaRace = await Promise.all([
    request(
      dispatcherA, "POST", etaPath,
      {
        estimated_duration_minutes: 120,
        revision: eta.revision,
      }
    ),
    request(
      dispatcherB, "POST", etaPath,
      {
        estimated_duration_minutes: 240,
        revision: eta.revision,
      }
    ),
  ]);

  eta = await getEta();

  check(
    etaRace.map((item) => item.status)
      .sort().join(",") === "200,409" &&
      [120, 240].includes(eta.estimated_duration_minutes),
    "Concurrent ETA updates produce one success and one revision conflict."
  );

  await expect(
    409, dispatcherA, "POST", etaPath,
    { estimated_duration_minutes: 180, revision: 0 }
  );

  eta = (await expect(
    200, dispatcherA, "POST", etaPath,
    {
      estimated_duration_minutes: 180,
      revision: eta.revision,
    }
  )).eta;

  await expect(
    409, dispatcherA, "POST",
    `/dispatcher/queue/${second}/depart`
  );

  await expect(
    409, dispatcherA, "POST",
    `/dispatcher/queue/${first}/complete`
  );

  await expect(
    200, dispatcherA, "POST",
    `/dispatcher/queue/${first}/depart`
  );

  check(
    true,
    "HTTP trip actions enforce FIFO and reject completion before departure."
  );

  await expect(
    409, dispatcherA, "POST", seatPath + "/assignment",
    { occupied_count: 0, revision: seats.revision }
  );

  await expect(
    409, dispatcherA, "POST", seatPath + "/capacity",
    { passenger_capacity: 18, revision: seats.revision }
  );

  check(
    true,
    "Seat and capacity changes are blocked after departure."
  );

  eta = await getEta();

  check(
    eta.status === "estimated" &&
      eta.destination === "Pasay City" &&
      eta.calculated_at &&
      Date.parse(eta.estimated_arrival_at) -
        Date.parse(eta.departed_at) === 180 * 60000,
    "Departure plus 180 minutes produces the correct Pasay ETA and calculation timestamp."
  );

  const ownQueue = await expect(
    200, driver, "GET", "/driver/queue?driver_id=2"
  );

  check(
    Number(ownQueue.arrival_id) === 1 &&
      Number(ownQueue.queue?.id) === Number(first) &&
      ownQueue.queue?.status === "departed",
    "The driver sees their own departed trip even when another driver ID is supplied."
  );

  // Controlled timestamps affect test fixtures, not the system clock.
  const utcDate = eta.retrieved_at.slice(0, 10);

  await sql(
    `UPDATE dispatcher_queue_entries
     SET departed_at = ?
     WHERE id = ?`,
    [`${utcDate} 15:30:00.000`, first]
  );

  eta = (await expect(
    200, dispatcherA, "POST", etaPath,
    {
      estimated_duration_minutes: 120,
      revision: eta.revision,
    }
  )).eta;

  const departureManila = new Date(
    Date.parse(eta.departed_at) + 8 * 3600000
  );

  const arrivalManila = new Date(
    Date.parse(eta.estimated_arrival_at) + 8 * 3600000
  );

  check(
    departureManila.getUTCHours() === 23 &&
      arrivalManila.getUTCHours() === 1 &&
      arrivalManila.toISOString().slice(0, 10) !==
        departureManila.toISOString().slice(0, 10) &&
      Date.parse(eta.estimated_arrival_at) -
        Date.parse(eta.departed_at) === 120 * 60000,
    "ETA calculation handles crossing midnight in Philippine time."
  );

  await sql(
    `UPDATE dispatcher_queue_entries
     SET departed_at = DATE_SUB(
       UTC_TIMESTAMP(3), INTERVAL 5 MINUTE
     )
     WHERE id = ?`,
    [first]
  );

  eta = (await expect(
    200, dispatcherA, "POST", etaPath,
    {
      estimated_duration_minutes: 1,
      revision: eta.revision,
    }
  )).eta;

  check(
    eta.status === "outdated",
    "A past estimated arrival is marked outdated."
  );

  eta = (await expect(
    200, dispatcherA, "POST", etaPath,
    {
      estimated_duration_minutes: 180,
      revision: eta.revision,
    }
  )).eta;

  check(
    eta.status === "estimated",
    "A revised future estimate becomes active again."
  );

  await expect(
    200, dispatcherA, "POST",
    `/dispatcher/queue/${first}/complete`
  );

  check(
    (await getEta()).status === "inactive",
    "Completed trips have inactive estimates."
  );

  await expect(
    409, dispatcherA, "POST", etaPath,
    {
      estimated_duration_minutes: 180,
      revision: eta.revision,
    }
  );

  const finished = await expect(
    200, driver, "GET", "/driver/arrival-request"
  );

  const finishedQueue = await expect(
    200, driver, "GET", "/driver/queue"
  );

  check(
    finishedQueue.arrival_status === "completed" &&
      finishedQueue.queue?.status === "completed",
    "Dispatcher completion is reflected in the driver's queue response."
  );

  check(
    finished.arrival?.is_active === false &&
      finished.arrival?.status === "completed",
    "Completion releases the driver's active arrival registration."
  );

  const finalQueue = await expect(
    200, dispatcherA, "GET", "/dispatcher/queue"
  );

  check(
    finalQueue.next_departure_id === second &&
      finalQueue.days.find(
        (day) => day.travel_date === finalQueue.today
      )?.allocated_count === 2,
    "Completion preserves allocation counters and advances the next departure."
  );

  await expect(
    200, dispatcherA, "POST", "/dispatcher/logout"
  );

  await expect(401, dispatcherA, "GET", seatPath);
  await expect(200, dispatcherB, "GET", etaPath);

  await expect(200, driver, "POST", "/driver/logout");
  await expect(401, driver, "GET", "/driver/queue");

  check(
    true,
    "Logout invalidates each session without logging out a different dispatcher."
  );

  console.log(
    `ALL ${passed} DISPATCHER HTTP/INTEGRATION CHECK GROUPS PASSED.`
  );

  console.log(
    "Browser/mobile/keyboard checks and passenger-view integration remain separate."
  );
};

try {
  await run();
} catch (error) {
  process.exitCode = 1;
  console.error(`FAIL: ${error.message}`);
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await pool.end();

  console.log(
    `Test database retained if created: ${database}`
  );

  console.log(
    "Normal application database and .env settings were not changed by this test."
  );
}
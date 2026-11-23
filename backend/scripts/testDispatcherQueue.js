import pool from "../config/db.js";
import queueConfig from "../config/queueConfig.js";
import { readFile } from "node:fs/promises";

const originalGetConnection = pool.getConnection.bind(pool);
const requestedBaseTime = Date.now() - 60000;

const testDatabase =
  `easyride_queue_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

const quote = (name) => {
  return `\`${String(name).replaceAll("`", "``")}\``;
};

const check = (condition, message) => {
  if (!condition) throw new Error(message);

  console.log(`PASS: ${message}`);
};

const tomorrowOf = (value) => {
  const date = new Date(`${value}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
};

const withConnection = async (operation) => {
  const connection = await pool.getConnection();

  try {
    return await operation(connection);
  } finally {
    connection.release();
  }
};

const addTestArrival = async (
  requestId,
  driverId,
  createDriver = true
) => {
  await withConnection(async (connection) => {
    if (createDriver) {
      await connection.execute(
        `
          INSERT INTO drivers (
            id,
            full_name,
            address,
            contact_number,
            plate_number,
            username,
            password
          )
          VALUES (
            ?,
            ?,
            'TEST ONLY',
            '09000000000',
            ?,
            ?,
            'TEST_ONLY_NOT_A_LOGIN_HASH'
          )
        `,
        [
          driverId,
          `Test Driver ${driverId}`,
          `QT-${driverId}`,
          `queue_test_${driverId}`,
        ]
      );
    }

    const requestedAt = new Date(
      requestedBaseTime + requestId * 1000
    )
      .toISOString()
      .slice(0, 23)
      .replace("T", " ");

    await connection.execute(
      `
        INSERT INTO driver_arrival_requests (
          id,
          driver_id,
          status,
          latitude,
          longitude,
          accuracy_meters,
          distance_meters,
          location_recorded_at,
          requested_at,
          confirmed_at
        )
        VALUES (
          ?,
          ?,
          'confirmed',
          13.9381011,
          120.7274174,
          10,
          0,
          ?,
          ?,
          ?
        )
      `,
      [
        requestId,
        driverId,
        requestedAt,
        requestedAt,
        requestedAt,
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
      [driverId, requestId]
    );
  });
};

const runTest = async () => {
  if (queueConfig.dailyLimit !== 18) {
    throw new Error(
      "This test expects the current daily limit of 18."
    );
  }

  const schema = await readFile(
    new URL(
      "../database/dispatcher_queue.sql",
      import.meta.url
    ),
    "utf8"
  );

  const statements = schema
    .split(";")
    .map((text) => text.trim())
    .filter(Boolean);

  const setupStatements = [];

  for (const statement of statements) {
    // Do not execute USE easyride_db from the SQL file.
    if (/^USE\s+/i.test(statement)) continue;

    const allowed =
      /^CREATE TABLE IF NOT EXISTS (dispatcher_queue_mutex|dispatcher_queue_days|dispatcher_queue_entries|driver_active_queues)\b/i.test(
        statement
      ) ||
      /^INSERT IGNORE INTO dispatcher_queue_mutex\b/i.test(
        statement
      );

    if (!allowed || statement.includes(".")) {
      throw new Error(
        "Unexpected queue SQL. Stop and send the current SQL file."
      );
    }

    setupStatements.push(statement);
  }

  if (!/^easyride_queue_test_\d+_\d+$/.test(testDatabase)) {
    throw new Error("Invalid test database name.");
  }

  const setup = await originalGetConnection();

  try {
    const [sourceRows] = await setup.query(
      "SELECT DATABASE() AS name"
    );

    const sourceDatabase = sourceRows[0].name;

    if (
      !sourceDatabase ||
      sourceDatabase.startsWith("easyride_queue_test_")
    ) {
      throw new Error(
        "Expected the application database as the structure source."
      );
    }

    // No existing database will be reused.
    await setup.query(
      `
        CREATE DATABASE ${quote(testDatabase)}
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_general_ci
      `
    );

    await setup.query(`USE ${quote(testDatabase)}`);

    const [selected] = await setup.query(
      "SELECT DATABASE() AS name"
    );

    if (selected[0].name !== testDatabase) {
      throw new Error("Database isolation failed.");
    }

    const sourceTables = [
      "drivers",
      "dispatchers",
      "driver_arrival_requests",
      "driver_active_arrivals",
    ];

    // Copy definitions only, not application records.
    for (const table of sourceTables) {
      await setup.query(
        `
          CREATE TABLE
            ${quote(testDatabase)}.${quote(table)}
          LIKE
            ${quote(sourceDatabase)}.${quote(table)}
        `
      );
    }

    for (const statement of setupStatements) {
      await setup.query(statement);
    }

    await setup.execute(
      `
        INSERT INTO dispatchers (
          id,
          full_name,
          username,
          password
        )
        VALUES (
          1,
          'Test Dispatcher',
          'queue_test_dispatcher',
          'TEST_ONLY_NOT_A_LOGIN_HASH'
        )
      `
    );
  } finally {
    setup.release();
  }

  // This affects this test process only.
  // It does not change the running backend configuration.
  pool.getConnection = async () => {
    const connection = await originalGetConnection();

    try {
      await connection.query(`USE ${quote(testDatabase)}`);

      const [rows] = await connection.query(
        "SELECT DATABASE() AS name"
      );

      if (rows[0].name !== testDatabase) {
        throw new Error("Database isolation failed.");
      }

      return connection;
    } catch (error) {
      connection.release();
      throw error;
    }
  };

  console.log(`Test database: ${testDatabase}`);

  const model = await import(
    "../models/dispatcherQueueModel.js"
  );

  // Create 19 confirmed arrivals in the isolated database.
  for (let id = 1; id <= 19; id += 1) {
    await addTestArrival(id, id);
  }

  const result = await model.allocateConfirmedArrivals(1);
  const today = result.today;
  const tomorrow = tomorrowOf(today);

  const todayEntries = result.allocations.filter(
    (entry) => entry.travel_date === today
  );

  const overflow = result.allocations.find(
    (entry) => entry.request_id === 19
  );

  check(
    result.allocations.length === 19,
    "All 19 confirmed test arrivals were allocated."
  );

  check(
    todayEntries.length === 18,
    "Only 18 allocations were assigned to today."
  );

  check(
    result.allocations.every(
      (entry, index) => entry.request_id === index + 1
    ),
    "Allocations follow request-time FIFO order."
  );

  check(
    todayEntries.every(
      (entry, index) => entry.queue_number === index + 1
    ),
    "Today's queue numbers are 1 through 18."
  );

  check(
    overflow?.travel_date === tomorrow &&
      overflow.queue_number === 1,
    "Request 19 is queue #1 on the next date."
  );

  const repeated = await model.allocateConfirmedArrivals(1);

  check(
    repeated.allocations.length === 0,
    "Repeated allocation does not duplicate entries."
  );

  try {
    await model.changeTripStatus(
      overflow.id,
      1,
      "depart"
    );

    throw new Error(
      "A future-date departure was incorrectly accepted."
    );
  } catch (error) {
    if (
      error.statusCode !== 409 &&
      error.status !== 409
    ) {
      throw error;
    }

    console.log(
      "PASS: The model rejects early departure of a future-date allocation."
    );
  }

  const first = result.allocations[0];

  await model.changeTripStatus(first.id, 1, "depart");
  await model.changeTripStatus(first.id, 1, "complete");

  let queue = await model.getQueue();

  const todayRow = queue.days.find(
    (day) => day.travel_date === today
  );

  check(
    todayRow?.allocated_count === 18 &&
      todayRow.remaining_slots === 0,
    "Completion does not free a daily allocation slot."
  );

  check(
    queue.entries.find(
      (entry) => entry.id === first.id
    )?.status === "completed",
    "The completed trip remains recorded."
  );

  // Returning driver: new request, same driver ID.
  await addTestArrival(20, 1, false);

  const returning = await model.allocateConfirmedArrivals(1);

  check(
    returning.allocations.length === 1 &&
      returning.allocations[0].request_id === 20 &&
      returning.allocations[0].travel_date === tomorrow &&
      returning.allocations[0].queue_number === 2,
    "A returning driver receives tomorrow's next slot, not today's completed slot."
  );

  queue = await model.getQueue();

  check(
    queue.today === today,
    "The Manila date stayed unchanged during the test."
  );

  // Two new arrivals and three simultaneous allocation calls.
  await addTestArrival(21, 20);
  await addTestArrival(22, 21);

  const concurrentAllocations = await Promise.all([
    model.allocateConfirmedArrivals(1),
    model.allocateConfirmedArrivals(1),
    model.allocateConfirmedArrivals(1),
  ]);

  const newAllocations = concurrentAllocations.flatMap(
    (batch) => batch.allocations
  );

  check(
    newAllocations.length === 2 &&
      new Set(
        newAllocations.map((entry) => entry.request_id)
      ).size === 2 &&
      newAllocations.every(
        (entry) => entry.travel_date === tomorrow
      ),
    "Concurrent allocation assigns each new request exactly once."
  );

  queue = await model.getQueue();

  const newEntries = queue.entries.filter(
    (entry) =>
      Number(entry.request_id) === 21 ||
      Number(entry.request_id) === 22
  );

  check(
    newEntries.length === 2 &&
      newEntries.find(
        (entry) => Number(entry.request_id) === 21
      )?.queue_number === 3 &&
      newEntries.find(
        (entry) => Number(entry.request_id) === 22
      )?.queue_number === 4,
    "Concurrent allocation preserves FIFO and unique queue numbers."
  );

  check(
    queue.days.find(
      (day) => day.travel_date === today
    )?.allocated_count === 18 &&
      queue.days.find(
        (day) => day.travel_date === tomorrow
      )?.allocated_count === 4,
    "Concurrent allocation leaves daily counters correct: 18 today, 4 tomorrow."
  );

  const second = result.allocations[1];
  const third = result.allocations[2];

  try {
    await model.changeTripStatus(third.id, 1, "depart");

    throw new Error(
      "An out-of-order departure was incorrectly accepted."
    );
  } catch (error) {
    if (
      error.statusCode !== 409 &&
      error.status !== 409
    ) {
      throw error;
    }

    console.log(
      "PASS: The model rejects out-of-order departure."
    );
  }

  const departures = await Promise.allSettled([
    model.changeTripStatus(second.id, 1, "depart"),
    model.changeTripStatus(second.id, 1, "depart"),
  ]);

  const departureError = departures.find(
    (outcome) => outcome.status === "rejected"
  )?.reason;

  check(
    departures.filter(
      (outcome) => outcome.status === "fulfilled"
    ).length === 1 &&
      (
        departureError?.statusCode === 409 ||
        departureError?.status === 409
      ),
    "Concurrent departure succeeds once and rejects the duplicate with 409."
  );

  const completions = await Promise.allSettled([
    model.changeTripStatus(second.id, 1, "complete"),
    model.changeTripStatus(second.id, 1, "complete"),
  ]);

  const completionError = completions.find(
    (outcome) => outcome.status === "rejected"
  )?.reason;

  check(
    completions.filter(
      (outcome) => outcome.status === "fulfilled"
    ).length === 1 &&
      (
        completionError?.statusCode === 409 ||
        completionError?.status === 409
      ),
    "Concurrent completion succeeds once and rejects the duplicate with 409."
  );

  queue = await model.getQueue();

  check(
    queue.entries.find(
      (entry) => entry.id === second.id
    )?.status === "completed" &&
      queue.next_departure_id === third.id &&
      queue.days.find(
        (day) => day.travel_date === today
      )?.allocated_count === 18 &&
      queue.today === today,
    "Final trip status, next departure, daily count, and Manila date remain correct."
  );

  console.log(
    "ALL DAILY-LIMIT AND CONCURRENCY TESTS PASSED."
  );

  console.log(
    "These are database/model tests, not Postman or browser tests."
  );
};

try {
  await runTest();
} catch (error) {
  process.exitCode = 1;
  console.error(`FAIL: ${error.message}`);
} finally {
  await pool.end();

  console.log(
    `Test database retained if created: ${testDatabase}`
  );
}
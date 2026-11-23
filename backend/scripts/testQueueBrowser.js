import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pool from "../config/db.js";
import driverRoutes from "../routes/driverRoutes.js";
import dispatcherRoutes from "../routes/dispatcherRoutes.js";

const testDatabase = process.argv[2];
const getOriginalConnection = pool.getConnection.bind(pool);

const quote = (value) => {
  return `\`${String(value).replaceAll("`", "``")}\``;
};

const demoPassword = "QueueDemo2026!";
const secret = process.env.SESSION_SECRET;

const frontendDirectory = fileURLToPath(
  new URL("../../dist/", import.meta.url)
);

const getTestConnection = async () => {
  const connection = await getOriginalConnection();

  try {
    await connection.query(`USE ${quote(testDatabase)}`);

    const [rows] = await connection.query(
      "SELECT DATABASE() AS name"
    );

    if (rows[0].name !== testDatabase) {
      throw new Error("Test database isolation failed.");
    }

    return connection;
  } catch (error) {
    connection.release();
    throw error;
  }
};

const runOnTestDatabase = async (method, sql, values) => {
  const connection = await getTestConnection();

  try {
    return await connection[method](sql, values);
  } finally {
    connection.release();
  }
};

const start = async () => {
  if (
    !/^easyride_queue_test_\d+_\d+$/.test(
      testDatabase || ""
    )
  ) {
    throw new Error(
      "Pass the exact isolated queue test database name."
    );
  }

  if (
    !secret ||
    secret.length < 32 ||
    /replace[-_]with|ilagay_dito/i.test(secret)
  ) {
    throw new Error(
      "A valid SESSION_SECRET is required in backend/.env."
    );
  }

  await access(
    new URL("../../dist/index.html", import.meta.url)
  );

  const source = await getOriginalConnection();
  let sourceDatabase;

  try {
    const [rows] = await source.query(
      "SELECT DATABASE() AS name"
    );

    sourceDatabase = rows[0].name;

    if (
      !sourceDatabase ||
      sourceDatabase.startsWith("easyride_queue_test_")
    ) {
      throw new Error(
        "Expected normal database settings as the structure source."
      );
    }
  } finally {
    source.release();
  }

  const setup = await getTestConnection();
  let transactionStarted = false;

  try {
    const [drivers] = await setup.execute(
      `
        SELECT id, username
        FROM drivers
        WHERE username IN (
          'queue_test_3',
          'queue_test_4'
        )
      `
    );

    const [dispatchers] = await setup.execute(
      `
        SELECT id
        FROM dispatchers
        WHERE username = 'queue_test_dispatcher'
      `
    );

    if (
      drivers.length !== 2 ||
      dispatchers.length !== 1
    ) {
      throw new Error(
        "Expected queue-test fixture accounts were not found. No fixture records changed."
      );
    }

    // Copy location-table structure only if missing.
    await setup.query(
      `
        CREATE TABLE IF NOT EXISTS
          ${quote(testDatabase)}.driver_locations
        LIKE
          ${quote(sourceDatabase)}.driver_locations
      `
    );

    await setup.beginTransaction();
    transactionStarted = true;

    const passwordHash = await bcrypt.hash(
      demoPassword,
      10
    );

    // These accounts exist only in the isolated test database.
    await setup.execute(
      `
        UPDATE drivers
        SET password = ?
        WHERE username IN (
          'queue_test_3',
          'queue_test_4'
        )
      `,
      [passwordHash]
    );

    await setup.execute(
      `
        UPDATE dispatchers
        SET password = ?
        WHERE username = 'queue_test_dispatcher'
      `,
      [passwordHash]
    );

    let [futureDrivers] = await setup.execute(
      `
        SELECT id
        FROM drivers
        WHERE username = 'queue_browser_future'
      `
    );

    if (!futureDrivers.length) {
      const [inserted] = await setup.execute(
        `
          INSERT INTO drivers (
            full_name,
            address,
            contact_number,
            plate_number,
            username,
            password
          )
          VALUES (
            'Browser Future Test',
            'TEST ONLY',
            '09000000000',
            'QB-FUTURE',
            'queue_browser_future',
            ?
          )
        `,
        [passwordHash]
      );

      futureDrivers = [{ id: inserted.insertId }];
    } else {
      await setup.execute(
        "UPDATE drivers SET password = ? WHERE id = ?",
        [passwordHash, futureDrivers[0].id]
      );
    }

    const futureDriverId = futureDrivers[0].id;

    let [futureEntries] = await setup.execute(
      `
        SELECT
          entry.id,
          DATE_FORMAT(
            entry.travel_date,
            '%Y-%m-%d'
          ) AS travel_date,
          entry.queue_number,
          DATE_FORMAT(
            DATE_ADD(
              UTC_TIMESTAMP(),
              INTERVAL 8 HOUR
            ),
            '%Y-%m-%d'
          ) AS today

        FROM driver_active_queues AS active

        JOIN dispatcher_queue_entries AS entry
          ON entry.id = active.queue_id
          AND entry.driver_id = active.driver_id

        WHERE active.driver_id = ?
      `,
      [futureDriverId]
    );

    if (
      futureEntries.length &&
      futureEntries[0].travel_date <=
        futureEntries[0].today
    ) {
      throw new Error(
        "The old browser fixture is no longer future-dated. Use a fresh isolated test database."
      );
    }

    if (!futureEntries.length) {
      const [dates] = await setup.query(
        `
          SELECT DATE_FORMAT(
            DATE_ADD(
              DATE_ADD(
                UTC_TIMESTAMP(),
                INTERVAL 8 HOUR
              ),
              INTERVAL 7 DAY
            ),
            '%Y-%m-%d'
          ) AS travel_date
        `
      );

      const date = dates[0].travel_date;

      const [arrival] = await setup.execute(
        `
          INSERT INTO driver_arrival_requests (
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
            'confirmed',
            13.9381011,
            120.7274174,
            10,
            0,
            UTC_TIMESTAMP(3),
            UTC_TIMESTAMP(3),
            UTC_TIMESTAMP(3)
          )
        `,
        [futureDriverId]
      );

      await setup.execute(
        `
          INSERT INTO driver_active_arrivals (
            driver_id,
            request_id
          )
          VALUES (?, ?)
        `,
        [futureDriverId, arrival.insertId]
      );

      await setup.execute(
        `
          INSERT IGNORE INTO dispatcher_queue_days (
            travel_date,
            allocated_count
          )
          VALUES (?, 0)
        `,
        [date]
      );

      const [days] = await setup.execute(
        `
          SELECT allocated_count
          FROM dispatcher_queue_days
          WHERE travel_date = ?
          FOR UPDATE
        `,
        [date]
      );

      const number =
        Number(days[0].allocated_count) + 1;

      if (number > 18) {
        throw new Error(
          "Browser fixture date is full. Use a fresh test database."
        );
      }

      await setup.execute(
        `
          UPDATE dispatcher_queue_days
          SET allocated_count = allocated_count + 1
          WHERE travel_date = ?
        `,
        [date]
      );

      const [entry] = await setup.execute(
        `
          INSERT INTO dispatcher_queue_entries (
            request_id,
            driver_id,
            travel_date,
            queue_number,
            allocated_by,
            allocated_at
          )
          VALUES (
            ?, ?, ?, ?, ?, UTC_TIMESTAMP(3)
          )
        `,
        [
          arrival.insertId,
          futureDriverId,
          date,
          number,
          dispatchers[0].id,
        ]
      );

      await setup.execute(
        `
          INSERT INTO driver_active_queues (
            driver_id,
            queue_id
          )
          VALUES (?, ?)
        `,
        [futureDriverId, entry.insertId]
      );

      futureEntries = [
        {
          travel_date: date,
          queue_number: number,
        },
      ];
    }

    await setup.commit();
    transactionStarted = false;

    console.log(
      `ISOLATED BROWSER TEST DATABASE: ${testDatabase}`
    );

    console.log(
      `Future fixture: ${futureEntries[0].travel_date}, queue #${futureEntries[0].queue_number}`
    );
  } catch (error) {
    if (transactionStarted) {
      await setup.rollback();
    }

    throw error;
  } finally {
    setup.release();
  }

  // Redirect this process's database calls to the test schema.
  pool.getConnection = getTestConnection;

  pool.execute = (sql, values) => {
    return runOnTestDatabase("execute", sql, values);
  };

  pool.query = (sql, values) => {
    return runOnTestDatabase("query", sql, values);
  };

  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.use(
    session({
      name: "easyride.queue-test.sid",
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 3600000,
      },
    })
  );

  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.use("/driver", driverRoutes);
  app.use("/dispatcher", dispatcherRoutes);

  app.use(express.static(frontendDirectory));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const status =
      error.statusCode || error.status || 500;

    if (status >= 500) {
      console.error(
        "Browser test error:",
        error.message
      );
    }

    return res.status(status).json({
      message:
        status >= 500
          ? "Check the browser-test terminal."
          : error.message,
    });
  });

  const server = app.listen(
    3001,
    "127.0.0.1",
    () => {
      console.log(
        "BROWSER TEST ONLY: http://127.0.0.1:3001/"
      );

      console.log(
        "Driver accounts: queue_test_3, queue_test_4, queue_browser_future"
      );

      console.log(
        "Dispatcher account: queue_test_dispatcher"
      );

      console.log(
        `Test-only password: ${demoPassword}`
      );

      console.log(
        "Normal backend and .env configuration are unchanged. Ctrl+C stops this test server."
      );
    }
  );

  server.on("error", async (error) => {
    console.error(
      "Browser test failed to start:",
      error.message
    );

    process.exitCode = 1;
    await pool.end();
  });
};

try {
  await start();
} catch (error) {
  console.error(
    "BROWSER TEST SETUP FAILED:",
    error.message
  );

  process.exitCode = 1;
  await pool.end();
}
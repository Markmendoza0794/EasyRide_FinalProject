import express from "express";
import session from "express-session";
import dispatcherRoutes from "./routes/dispatcherRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import passengerRoutes from "./routes/passengerRoutes.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;

if (
  !sessionSecret ||
  sessionSecret.length < 32 ||
  /replace[-_]with|ilagay_dito/i.test(sessionSecret)
) {
  throw new Error(
    "Set a generated SESSION_SECRET in backend/.env."
  );
}

app.use(express.json({ limit: "16kb" }));

app.use(
  session({
    name: "easyride.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use(["/driver", "/dispatcher"], (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use("/driver", driverRoutes);
app.use("/dispatcher", dispatcherRoutes);
app.use("/passenger", passengerRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode =
    error.statusCode || error.status || 500;

  if (statusCode >= 500) {
    console.error("EasyRide backend error:", error);
  }

  return res.status(statusCode).json({
    message:
      statusCode >= 500
        ? "Unable to process the request. Check the backend terminal."
        : error.message,
  });
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(
    "EASYRIDE Backend: http://127.0.0.1:" + port
  );
});

server.on("error", (error) => {
  console.error("Backend failed to start:", error.message);
  process.exitCode = 1;
});

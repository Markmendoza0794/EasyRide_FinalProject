import express from "express";
import * as driverController from "../controllers/driverController.js";
import * as driverLocationController from "../controllers/driverLocationController.js";
import * as driverArrivalController from "../controllers/driverArrivalController.js";
import * as driverQueueController from "../controllers/driverQueueController.js";
import requireDriver from "../middleware/requireDriver.js";

const router = express.Router();

const requireRequestHeader = (req, res, next) => {
  if (req.get("X-EasyRide-Request") !== "1") {
    return res.status(403).json({
      message: "Invalid request.",
    });
  }

  return next();
};

router.post(
  "/register",
  driverController.createDriver
);

router.post(
  "/login",
  requireRequestHeader,
  driverController.loginDriver
);

router.get(
  "/session",
  requireDriver,
  driverController.getDriverSession
);

router.post(
  "/logout",
  requireRequestHeader,
  driverController.logoutDriver
);

router.get(
  "/location",
  requireDriver,
  driverLocationController.getLocation
);

router.post(
  "/location",
  requireRequestHeader,
  requireDriver,
  driverLocationController.updateLocation
);

router.post(
  "/arrival-check",
  requireRequestHeader,
  requireDriver,
  driverArrivalController.checkArrivalLocation
);

router.post(
  "/arrival-request",
  requireRequestHeader,
  requireDriver,
  driverArrivalController.createArrivalRequest
);

router.get(
  "/arrival-request",
  requireDriver,
  driverArrivalController.getArrivalRequest
);

router.get(
  "/queue",
  requireDriver,
  driverQueueController.getDriverQueue
);

export default router;
import * as passengerAvailabilityController from "../controllers/passengerAvailabilityController.js";
import express from "express";
import * as dispatcherController from "../controllers/dispatcherController.js";
import * as dispatcherArrivalController from "../controllers/dispatcherArrivalController.js";
import * as dispatcherQueueController from "../controllers/dispatcherQueueController.js";
import * as dispatcherSeatController from "../controllers/dispatcherSeatController.js";
import requireDispatcher from "../middleware/requireDispatcher.js";

import * as dispatcherEtaController from "../controllers/dispatcherEtaController.js";

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
  "/login",
  requireRequestHeader,
  dispatcherController.loginDispatcher
);

router.get(
  "/session",
  requireDispatcher,
  dispatcherController.getDispatcherSession
);

router.get(
  "/dashboard",
  requireDispatcher,
  dispatcherController.getDispatcherDashboard
);

router.get(
  "/arrivals",
  requireDispatcher,
  dispatcherArrivalController.getActiveArrivals
);

router.post(
  "/arrivals/:requestId/review",
  requireRequestHeader,
  requireDispatcher,
  dispatcherArrivalController.reviewArrivalRequest
);

router.get(
  "/queue",
  requireDispatcher,
  dispatcherQueueController.getQueue
);

router.post(
  "/queue/allocate",
  requireRequestHeader,
  requireDispatcher,
  dispatcherQueueController.allocateConfirmedArrivals
);

router.post(
  "/queue/:queueId/depart",
  requireRequestHeader,
  requireDispatcher,
  (req, res, next) => {
    req.params.action = "depart";

    return dispatcherQueueController.updateTrip(
      req,
      res,
      next
    );
  }
);

router.post(
  "/queue/:queueId/complete",
  requireRequestHeader,
  requireDispatcher,
  (req, res, next) => {
    req.params.action = "complete";

    return dispatcherQueueController.updateTrip(
      req,
      res,
      next
    );
  }
);

router.get(
  "/queue/:queueId/seats",
  requireDispatcher,
  dispatcherSeatController.getTripSeats
);

router.post(
  "/queue/:queueId/seats/capacity",
  requireRequestHeader,
  requireDispatcher,
  dispatcherSeatController.saveTripCapacity
);

router.post(
  "/queue/:queueId/seats/assignment",
  requireRequestHeader,
  requireDispatcher,
  dispatcherSeatController.updateSeatAssignment
);

router.post(
  "/logout",
  requireRequestHeader,
  dispatcherController.logoutDispatcher
);

router.get(
  "/queue/:queueId/eta",
  requireDispatcher,
  dispatcherEtaController.getTripEta
);

router.post(
  "/queue/:queueId/eta",
  requireRequestHeader,
  requireDispatcher,
  dispatcherEtaController.saveTripEta
);

router.get(
  "/queue/:queueId/boarding",
  requireDispatcher,
  passengerAvailabilityController.getBoarding
);

router.post(
  "/queue/:queueId/boarding",
  requireRequestHeader,
  requireDispatcher,
  passengerAvailabilityController.saveBoarding
);

export default router;

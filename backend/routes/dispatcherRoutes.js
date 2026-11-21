import express from "express";
import * as dispatcherController from "../controllers/dispatcherController.js";
import * as dispatcherArrivalController from "../controllers/dispatcherArrivalController.js";
import requireDispatcher from "../middleware/requireDispatcher.js";

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

router.post(
  "/logout",
  requireRequestHeader,
  dispatcherController.logoutDispatcher
);

export default router;
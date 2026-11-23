import * as passengerAvailabilityController from "../controllers/passengerAvailabilityController.js";
import express from "express";
import * as passengerSeatController from "../controllers/passengerSeatController.js";

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get(
  "/seats",
  passengerSeatController.getSeatAvailability
);

router.get(
  "/vans",
  passengerAvailabilityController.getVanAvailability
);

export default router;

import * as dispatcherQueueModel from "../models/dispatcherQueueModel.js";
import ValidationError from "../utils/ValidationError.js";

const getQueue = async (req, res, next) => {
  try {
    const result = await dispatcherQueueModel.getQueue();

    res.set("Cache-Control", "no-store");

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const allocateConfirmedArrivals = async (req, res, next) => {
  try {
    const result =
      await dispatcherQueueModel.allocateConfirmedArrivals(
        req.session.dispatcherId
      );

    return res.status(200).json({
      ...result,
      message: result.allocations.length
        ? `${result.allocations.length} confirmed arrival(s) allocated through FIFO.`
        : "No unallocated confirmed arrivals.",
    });
  } catch (error) {
    return next(error);
  }
};

const updateTrip = async (req, res, next) => {
  try {
    const { queueId, action } = req.params;

    if (
      !/^[1-9]\d*$/.test(queueId) ||
      !Number.isSafeInteger(Number(queueId))
    ) {
      throw new ValidationError(
        400,
        "Invalid queue entry ID."
      );
    }

    if (!["depart", "complete"].includes(action)) {
      throw new ValidationError(
        400,
        "Invalid trip action."
      );
    }

    const entry =
      await dispatcherQueueModel.changeTripStatus(
        Number(queueId),
        req.session.dispatcherId,
        action
      );

    return res.status(200).json({
      entry,
      message:
        action === "depart"
          ? "Departure recorded."
          : "Trip completed. A returning driver may submit a new arrival request.",
    });
  } catch (error) {
    return next(error);
  }
};

export {
  getQueue,
  allocateConfirmedArrivals,
  updateTrip,
};
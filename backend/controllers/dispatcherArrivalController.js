import * as dispatcherArrivalModel from "../models/dispatcherArrivalModel.js";
import * as dispatcherArrivalService from "../services/dispatcherArrivalService.js";

const getActiveArrivals = async (req, res, next) => {
  try {
    const arrivals =
      await dispatcherArrivalModel.fetchActiveArrivals();

    return res.status(200).json({
      arrivals,
    });
  } catch (error) {
    return next(error);
  }
};

const reviewArrivalRequest = async (req, res, next) => {
  try {
    const result =
      await dispatcherArrivalService.reviewArrivalRequest(
        req.session.dispatcherId,
        req.params.requestId,
        req.body
      );

    return res.status(200).json({
      message:
        result.status === "confirmed"
          ? "Terminal arrival confirmed. No queue number has been assigned yet."
          : "Arrival request rejected.",
      arrival: result,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  getActiveArrivals,
  reviewArrivalRequest,
};
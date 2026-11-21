import * as driverArrivalService from "../services/driverArrivalService.js";

const checkArrivalLocation = async (req, res, next) => {
  try {
    const result =
      await driverArrivalService.validateDriverArrival(
        req.session.driverId
      );

    return res.status(200).json({
      message:
        "Location check passed. Terminal arrival is not yet confirmed.",
      location_check: result,
    });
  } catch (error) {
    return next(error);
  }
};

const createArrivalRequest = async (req, res, next) => {
  try {
    const arrival =
      await driverArrivalService.createArrivalRequest(
        req.session.driverId
      );

    return res.status(201).json({
      message:
        "Arrival request submitted. Please wait for dispatcher confirmation.",
      arrival,
    });
  } catch (error) {
    return next(error);
  }
};

const getArrivalRequest = async (req, res, next) => {
  try {
    const arrival =
      await driverArrivalService.getArrivalRequest(
        req.session.driverId
      );

    return res.status(200).json({
      arrival,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  checkArrivalLocation,
  createArrivalRequest,
  getArrivalRequest,
};
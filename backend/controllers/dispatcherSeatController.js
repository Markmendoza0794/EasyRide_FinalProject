import * as seatService from "../services/dispatcherSeatService.js";

const getTripSeats = async (req, res, next) => {
  try {
    const seats = await seatService.getTripSeats(
      req.params.queueId
    );

    return res.status(200).json({ seats });
  } catch (error) {
    return next(error);
  }
};

const saveTripCapacity = async (req, res, next) => {
  try {
    const seats = await seatService.saveTripCapacity(
      req.params.queueId,
      req.session.dispatcherId,
      req.body
    );

    return res.status(200).json({
      message: "Passenger capacity saved.",
      seats,
    });
  } catch (error) {
    return next(error);
  }
};

const updateSeatAssignment = async (req, res, next) => {
  try {
    const seats = await seatService.updateSeatAssignment(
      req.params.queueId,
      req.session.dispatcherId,
      req.body
    );

    return res.status(200).json({
      message: "Seat assignment updated.",
      seats,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  getTripSeats,
  saveTripCapacity,
  updateSeatAssignment,
};
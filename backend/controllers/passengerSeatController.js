import * as passengerSeatService from "../services/passengerSeatService.js";

const getSeatAvailability = async (req, res, next) => {
  try {
    const result = await passengerSeatService.getSeatAvailability();

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export { getSeatAvailability };

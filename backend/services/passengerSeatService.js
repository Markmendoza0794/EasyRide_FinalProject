import * as passengerSeatModel from "../models/passengerSeatModel.js";
import ValidationError from "../utils/ValidationError.js";

const getSeatAvailability = async () => {
  try {
    return await passengerSeatModel.getSeatAvailability();
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      throw new ValidationError(
        503,
        "Passenger seat information is temporarily unavailable."
      );
    }

    throw error;
  }
};

export { getSeatAvailability };

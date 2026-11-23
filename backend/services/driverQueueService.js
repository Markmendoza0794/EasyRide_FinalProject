import * as driverQueueModel from "../models/driverQueueModel.js";
import ValidationError from "../utils/ValidationError.js";

const getDriverQueue = async (driverId) => {
  if (!Number.isSafeInteger(driverId) || driverId <= 0) {
    throw new ValidationError(
      401,
      "Please log in to your driver account."
    );
  }

  try {
    return await driverQueueModel.findDriverQueue(driverId);
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      throw new ValidationError(
        503,
        "Queue information is not available yet. Please contact the dispatcher."
      );
    }

    throw error;
  }
};

export { getDriverQueue };
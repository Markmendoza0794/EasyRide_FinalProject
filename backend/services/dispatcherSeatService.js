import * as seatModel from "../models/dispatcherSeatModel.js";
import ValidationError from "../utils/ValidationError.js";

const parseTripId = (value) => {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw new ValidationError(400, "Invalid trip ID.");
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new ValidationError(400, "Invalid trip ID.");
  }

  return id;
};

const requireBody = (body) => {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new ValidationError(
      400,
      "A JSON object is required."
    );
  }
};

const runSeatOperation = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      throw new ValidationError(
        503,
        "Seat database setup is incomplete."
      );
    }

    throw error;
  }
};

const getTripSeats = async (tripId) => {
  const id = parseTripId(tripId);

  return runSeatOperation(
    () => seatModel.getTripSeats(id)
  );
};

const saveTripCapacity = async (
  tripId,
  dispatcherId,
  body
) => {
  const id = parseTripId(tripId);

  requireBody(body);

  return runSeatOperation(() =>
    seatModel.setTripCapacity(
      id,
      dispatcherId,
      body.passenger_capacity,
      body.revision
    )
  );
};

const updateSeatAssignment = async (
  tripId,
  dispatcherId,
  body
) => {
  const id = parseTripId(tripId);

  requireBody(body);

  return runSeatOperation(() =>
    seatModel.changeSeatAssignment(
      id,
      dispatcherId,
      body.occupied_count,
      body.revision
    )
  );
};

export {
  getTripSeats,
  saveTripCapacity,
  updateSeatAssignment,
};
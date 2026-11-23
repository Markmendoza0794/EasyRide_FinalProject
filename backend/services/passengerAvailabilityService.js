import * as availabilityModel from "../models/passengerAvailabilityModel.js";
import ValidationError from "../utils/ValidationError.js";

const parseTripId = (value) => {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 2147483647
  ) {
    throw new ValidationError(400, "Invalid trip ID.");
  }

  return Number(value);
};

const runOperation = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      throw new ValidationError(
        503,
        "Van availability database setup is incomplete."
      );
    }

    throw error;
  }
};

const getBoarding = async (tripId) => {
  const id = parseTripId(tripId);

  return runOperation(() => availabilityModel.getBoarding(id));
};

const saveBoarding = async (tripId, dispatcherId, body) => {
  const id = parseTripId(tripId);

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.is_boarding !== "boolean" ||
    typeof body.revision !== "number" ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    body.revision > 4294967294
  ) {
    throw new ValidationError(
      400,
      "A boarding flag and a valid revision are required."
    );
  }

  return runOperation(() =>
    availabilityModel.saveBoarding(
      id,
      dispatcherId,
      body.is_boarding,
      body.revision
    )
  );
};

const getVanAvailability = async () => {
  return runOperation(
    () => availabilityModel.getVanAvailability()
  );
};

export {
  getBoarding,
  saveBoarding,
  getVanAvailability,
};

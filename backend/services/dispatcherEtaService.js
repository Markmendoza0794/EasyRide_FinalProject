import * as etaModel from "../models/dispatcherEtaModel.js";
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

const runEtaOperation = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      throw new ValidationError(
        503,
        "ETA database setup is incomplete."
      );
    }

    throw error;
  }
};

const getTripEta = async (tripId) => {
  const id = parseTripId(tripId);

  return runEtaOperation(
    () => etaModel.getTripEta(id)
  );
};

const saveTripEta = async (
  tripId,
  dispatcherId,
  body
) => {
  const id = parseTripId(tripId);

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

  return runEtaOperation(() =>
    etaModel.saveTripEta(
      id,
      dispatcherId,
      body.estimated_duration_minutes,
      body.revision
    )
  );
};

export {
  getTripEta,
  saveTripEta,
};
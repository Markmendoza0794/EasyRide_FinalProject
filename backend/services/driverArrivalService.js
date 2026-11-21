import terminalConfig from "../config/terminalConfig.js";
import calculateDistance from "../utils/calculateDistance.js";
import ValidationError from "../utils/ValidationError.js";
import * as driverLocationModel from "../models/driverLocationModel.js";
import * as driverArrivalModel from "../models/driverArrivalModel.js";

const validateDriverArrival = async (driverId) => {
  const location =
    await driverLocationModel.findLocation(driverId);

  if (!location) {
    throw new ValidationError(
      400,
      "Start location sharing and wait for a successful update."
    );
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = Number(location.accuracy);
  const recordedAt = new Date(location.recorded_at).getTime();

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    !Number.isFinite(recordedAt)
  ) {
    throw new ValidationError(
      400,
      "Saved location is invalid. Please update your location."
    );
  }

  const locationAgeSeconds =
    (Date.now() - recordedAt) / 1000;

  if (
    locationAgeSeconds < 0 ||
    locationAgeSeconds >
      terminalConfig.maxLocationAgeSeconds
  ) {
    throw new ValidationError(
      400,
      "Your saved location has expired. Please update your location."
    );
  }

  if (accuracy > terminalConfig.maxAccuracyMeters) {
    throw new ValidationError(
      400,
      "Location is too imprecise. Please retry with a more accurate location."
    );
  }

  const distanceMeters = calculateDistance(
    latitude,
    longitude,
    terminalConfig.latitude,
    terminalConfig.longitude
  );

  if (
    distanceMeters + accuracy >
    terminalConfig.radiusMeters
  ) {
    throw new ValidationError(
      400,
      "Your location cannot be verified inside the terminal boundary. Please retry at the terminal."
    );
  }

  return {
    terminal_name: terminalConfig.name,
    latitude,
    longitude,
    distance_meters: distanceMeters,
    accuracy_meters: accuracy,
    location_recorded_at: location.recorded_at,
  };
};

const createArrivalRequest = async (driverId) => {
  const latestArrival =
    await driverArrivalModel.findLatestArrival(driverId);

  if (latestArrival?.is_active) {
    throw new ValidationError(
      409,
      "You already have an active arrival request."
    );
  }

  const location = await validateDriverArrival(driverId);

  await driverArrivalModel.createPendingArrival(
    driverId,
    location
  );

  return driverArrivalModel.findLatestArrival(driverId);
};

const getArrivalRequest = async (driverId) => {
  return driverArrivalModel.findLatestArrival(driverId);
};

export {
  validateDriverArrival,
  createArrivalRequest,
  getArrivalRequest,
};
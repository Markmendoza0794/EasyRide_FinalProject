import * as availabilityService from "../services/passengerAvailabilityService.js";

const getBoarding = async (req, res, next) => {
  try {
    const boarding = await availabilityService.getBoarding(
      req.params.queueId
    );

    res.set("Cache-Control", "no-store");
    return res.status(200).json({ boarding });
  } catch (error) {
    return next(error);
  }
};

const saveBoarding = async (req, res, next) => {
  try {
    const boarding = await availabilityService.saveBoarding(
      req.params.queueId,
      req.session.dispatcherId,
      req.body
    );

    return res.status(200).json({
      boarding,
      message: boarding.is_boarding
        ? "Boarding started."
        : "Boarding stopped.",
    });
  } catch (error) {
    return next(error);
  }
};

const getVanAvailability = async (req, res, next) => {
  try {
    const result = await availabilityService.getVanAvailability();

    res.set("Cache-Control", "no-store");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export {
  getBoarding,
  saveBoarding,
  getVanAvailability,
};

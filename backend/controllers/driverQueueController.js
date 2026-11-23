import * as driverQueueService from "../services/driverQueueService.js";

const getDriverQueue = async (req, res, next) => {
  res.set("Cache-Control", "no-store");

  try {
    const result = await driverQueueService.getDriverQueue(
      req.session.driverId
    );

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export { getDriverQueue };
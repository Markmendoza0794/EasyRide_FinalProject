import * as etaService from "../services/dispatcherEtaService.js";

const getTripEta = async (req, res, next) => {
  try {
    const eta = await etaService.getTripEta(
      req.params.queueId
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({ eta });
  } catch (error) {
    return next(error);
  }
};

const saveTripEta = async (req, res, next) => {
  try {
    const eta = await etaService.saveTripEta(
      req.params.queueId,
      req.session.dispatcherId,
      req.body
    );

    return res.status(200).json({
      message: "Estimated travel duration saved.",
      eta,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  getTripEta,
  saveTripEta,
};
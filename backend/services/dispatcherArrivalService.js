import ValidationError from "../utils/ValidationError.js";
import * as dispatcherArrivalReviewModel from "../models/dispatcherArrivalReviewModel.js";

const reviewArrivalRequest = async (
  dispatcherId,
  requestId,
  body
) => {
  const idText = String(requestId);

  if (!/^[1-9]\d*$/.test(idText)) {
    throw new ValidationError(
      400,
      "A valid arrival request ID is required."
    );
  }

  const id = Number(idText);

  if (!Number.isSafeInteger(id)) {
    throw new ValidationError(
      400,
      "A valid arrival request ID is required."
    );
  }

  const decision = body?.decision;

  if (!["confirmed", "rejected"].includes(decision)) {
    throw new ValidationError(
      400,
      "Decision must be confirmed or rejected."
    );
  }

  if (
    body?.note !== undefined &&
    typeof body.note !== "string"
  ) {
    throw new ValidationError(
      400,
      "Review note must be text."
    );
  }

  const note = (body?.note || "").trim();

  if (note.length > 255) {
    throw new ValidationError(
      400,
      "Review note must not exceed 255 characters."
    );
  }

  if (decision === "rejected" && !note) {
    throw new ValidationError(
      400,
      "Please provide a reason for rejecting the request."
    );
  }

  if (
    decision === "confirmed" &&
    body?.terminalPresenceVerified !== true
  ) {
    throw new ValidationError(
      400,
      "Verify that the driver and vehicle are physically at the terminal before confirming."
    );
  }

  return dispatcherArrivalReviewModel.reviewArrival({
    requestId: id,
    dispatcherId,
    decision,
    note,
  });
};

export { reviewArrivalRequest };
import pool from "../config/db.js";
import ValidationError from "../utils/ValidationError.js";

const reviewArrival = async ({
  requestId,
  dispatcherId,
  decision,
  note,
}) => {
  if (!["confirmed", "rejected"].includes(decision)) {
    throw new ValidationError(
      400,
      "Invalid arrival decision."
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.execute(
      `
        SELECT driver_id
        FROM driver_arrival_requests
        WHERE id = ?
      `,
      [requestId]
    );

    if (!requests.length) {
      throw new ValidationError(
        404,
        "Arrival request not found."
      );
    }

    const driverId = requests[0].driver_id;

    // Use the same lock order as driver request creation.
    await connection.execute(
      `
        SELECT id
        FROM drivers
        WHERE id = ?
        FOR UPDATE
      `,
      [driverId]
    );

    const [lockedRequests] = await connection.execute(
      `
        SELECT id, status
        FROM driver_arrival_requests
        WHERE id = ?
        FOR UPDATE
      `,
      [requestId]
    );

    if (
      !lockedRequests.length ||
      lockedRequests[0].status !== "pending"
    ) {
      throw new ValidationError(
        409,
        "This request has already been reviewed or closed."
      );
    }

    const [activeRequests] = await connection.execute(
      `
        SELECT request_id
        FROM driver_active_arrivals
        WHERE driver_id = ?
        FOR UPDATE
      `,
      [driverId]
    );

    if (
      !activeRequests.length ||
      Number(activeRequests[0].request_id) !== Number(requestId)
    ) {
      throw new ValidationError(
        409,
        "This arrival request is no longer active."
      );
    }

    await connection.execute(
      `
        UPDATE driver_arrival_requests
        SET
          status = ?,
          reviewed_by = ?,
          reviewed_at = UTC_TIMESTAMP(3),
          review_note = ?,
          confirmed_at = CASE
            WHEN ? = 'confirmed' THEN UTC_TIMESTAMP(3)
            ELSE NULL
          END,
          resolved_at = CASE
            WHEN ? = 'rejected' THEN UTC_TIMESTAMP(3)
            ELSE NULL
          END
        WHERE id = ?
          AND status = 'pending'
      `,
      [
        decision,
        dispatcherId,
        note || null,
        decision,
        decision,
        requestId,
      ]
    );

    if (decision === "rejected") {
      await connection.execute(
        `
          DELETE FROM driver_active_arrivals
          WHERE driver_id = ?
            AND request_id = ?
        `,
        [driverId, requestId]
      );
    }

    await connection.commit();

    return {
      request_id: Number(requestId),
      status: decision,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { reviewArrival };
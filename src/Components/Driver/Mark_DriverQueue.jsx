import { useEffect, useState } from "react";

const formatQueueDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00+08:00`);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleDateString(undefined, {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const formatQueueTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
};

const Mark_DriverQueue = ({
  arrivalId,
  arrivalStatus,
  refreshKey,
  onRefresh,
  busy,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!arrivalId) return;

    const controller = new AbortController();

    const loadQueue = async () => {
      setLoading(true);
      setError("");
      setData(null);
      setUpdatedAt(null);

      try {
        const response = await fetch("/driver/queue", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await response.json().catch(() => null);

        if (!result) {
          throw new Error(
            "Invalid queue response. Please try refreshing."
          );
        }

        if (!response.ok) {
          throw new Error(
            result.message || "Unable to load queue information."
          );
        }

        if (
          !Object.prototype.hasOwnProperty.call(result, "queue")
        ) {
          throw new Error(
            "Invalid queue response. Please try refreshing."
          );
        }

        if (!controller.signal.aborted) {
          setData(result);
          setUpdatedAt(new Date().toISOString());
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof TypeError
              ? "Cannot connect to the backend. Queue information is unavailable."
              : requestError.message
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadQueue();

    return () => controller.abort();
  }, [arrivalId, arrivalStatus, refreshKey]);

  const sameArrival =
    data && Number(data.arrival_id) === Number(arrivalId);

  const queue = sameArrival ? data.queue : null;

  const statusLabels = {
    waiting: "Waiting",
    departed: "Departed",
    completed: "Completed",
  };

  const noQueueMessage =
    data?.arrival_status === "pending"
      ? "Waiting for dispatcher confirmation. No queue has been assigned yet."
      : data?.arrival_status === "confirmed"
        ? "Arrival confirmed. Waiting for dispatcher queue allocation."
        : "No queue allocation is recorded for this arrival request.";

  if (!arrivalId) return null;

  return (
    <section
      aria-label="Your assigned queue"
      aria-busy={loading}
    >
      <h3>Your Queue Information</h3>

      {loading && (
        <p role="status">Loading queue information...</p>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && data && !sameArrival && (
        <p role="status">
          Your latest arrival request has changed.
          Use Refresh Status to load it.
        </p>
      )}

      {!loading && !error && sameArrival && !queue && (
        <p role="status">{noQueueMessage}</p>
      )}

      {!loading && !error && queue && (
        <>
          <dl className="driver-profile-details">
            <dt>Assigned Queue Number</dt>
            <dd>#{queue.queue_number}</dd>

            <dt>Travel Date (Philippines)</dt>
            <dd>{formatQueueDate(queue.travel_date)}</dd>

            <dt>Waiting Position on Travel Date</dt>
            <dd>
              {queue.status === "waiting"
                ? queue.waiting_position
                : "—"}
            </dd>

            <dt>Trip Status</dt>
            <dd>
              {statusLabels[queue.status] || "Unavailable"}
            </dd>

            <dt>Departure</dt>
            <dd>{formatQueueTime(queue.departed_at)}</dd>

            <dt>Completion</dt>
            <dd>{formatQueueTime(queue.completed_at)}</dd>
          </dl>

          {queue.status === "waiting" &&
            queue.travel_date > queue.today && (
              <p>
                This trip is staged for a future travel date
                and cannot depart early.
              </p>
            )}

          {queue.status === "waiting" &&
            queue.travel_date <= queue.today && (
              <p>
                {queue.waiting_position === 1
                  ? "You are first among the waiting vans on your travel date. The dispatcher controls departure."
                  : "Please wait for earlier vans. The dispatcher controls departure."}
              </p>
            )}

          {queue.status === "departed" && (
            <p>
              Your trip has departed. The dispatcher will
              record completion after your return.
            </p>
          )}

          {queue.status === "completed" && (
            <p>
              Trip completed. Submit a new arrival request
              when returning for another allocation.
            </p>
          )}
        </>
      )}

      {!loading && !error && updatedAt && (
        <p>
          Last queue refresh: {formatQueueTime(updatedAt)}
        </p>
      )}

      <button
        type="button"
        className="auth-back"
        disabled={loading || busy}
        onClick={onRefresh}
      >
        Refresh Queue Information
      </button>

      <p>
        Queue information updates when this panel opens
        or you refresh it.
      </p>
    </section>
  );
};

export default Mark_DriverQueue;
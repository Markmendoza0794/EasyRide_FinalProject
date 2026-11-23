import { useEffect, useRef, useState } from "react";
import "./dispatcherQueue.css";
import QueueConfirmDialog from "./QueueConfirmDialog";

const readResponse = async (response) => {
  const result = await response.json().catch(() => null);

  if (!result) {
    throw new Error(
      "Invalid response. Check the backend and Vite proxy."
    );
  }

  if (!response.ok) {
    throw new Error(result.message || "Queue request failed.");
  }

  return result;
};

const formatDate = (value) => {
  return new Date(
    `${value}T00:00:00+08:00`
  ).toLocaleDateString(undefined, {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
};

const Jessie_QueueDispatch = ({ onTripChange }) => {
  const actionInProgress = useRef(false);

  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadQueue = async () => {
      setLoading(true);

      try {
        const response = await fetch("/dispatcher/queue", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readResponse(response);

        if (
          !Array.isArray(result.entries) ||
          !Array.isArray(result.days)
        ) {
          throw new Error("Queue information is incomplete.");
        }

        if (!controller.signal.aborted) {
          setQueue(result);
          setUpdatedAt(new Date());
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof TypeError
              ? "Cannot connect to the backend."
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
  }, [refreshCount]);

  const refreshQueue = () => {
    setError("");
    setMessage("");
    setRefreshCount((count) => count + 1);
  };

  const handleAction = async (path, confirmation) => {
    if (
      loading ||
      acting ||
      error ||
      actionInProgress.current
    ) {
      return;
    }

    if (confirmation) {
      setPendingConfirmation({
        path,
        message: confirmation,
      });

      return;
    }

    actionInProgress.current = true;
    setActing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-EasyRide-Request": "1",
        },
      });

      const result = await readResponse(response);

      setMessage(result.message);
      onTripChange?.();
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Connection interrupted. Refresh before retrying; the action may already have completed."
          : requestError.message
      );
    } finally {
      actionInProgress.current = false;
      setActing(false);
      setRefreshCount((count) => count + 1);
    }
  };

  const confirmPendingAction = () => {
    const selected = pendingConfirmation;

    setPendingConfirmation(null);

    if (selected) {
      handleAction(selected.path);
    }
  };

  const busy = loading || acting;
  const blocked =
    busy || Boolean(error) || Boolean(pendingConfirmation);

  const todayAllocation =
    queue?.days.find(
      (day) => day.travel_date === queue.today
    )?.allocated_count ?? 0;

  return (
    <section
      className="dispatcher-queue-panel"
      aria-labelledby="dispatcher-queue-title"
      aria-busy={busy}
    >
      <QueueConfirmDialog
        confirmation={pendingConfirmation}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
      />

      <header className="dispatcher-queue-heading">
        <div>
          <p className="dispatcher-eyebrow">
            QUEUE AND DISPATCH
          </p>

          <h2 id="dispatcher-queue-title">
            Daily FIFO Queue
          </h2>

          <p>
            Allocate confirmed arrivals and manage trips.
          </p>
        </div>

        <div className="dispatcher-queue-controls">
          <button
            type="button"
            className="dispatcher-login-button"
            disabled={blocked || !queue}
            onClick={() =>
              handleAction("/dispatcher/queue/allocate")
            }
          >
            {acting
              ? "Processing..."
              : "Allocate Confirmed Arrivals"}
          </button>

          <button
            type="button"
            className="dispatcher-queue-refresh"
            disabled={busy || Boolean(pendingConfirmation)}
            onClick={refreshQueue}
          >
            {loading ? "Loading..." : "Refresh Queue"}
          </button>
        </div>
      </header>

      {queue && (
        <p className="dispatcher-monitoring-note">
          Philippine date: {formatDate(queue.today)}
          {" · "}
          Today: {todayAllocation}/{queue.daily_limit}
          {" "}slots allocated.
          Completed trips still count toward the daily limit.
        </p>
      )}

      {updatedAt && (
        <p className="dispatcher-monitoring-note">
          Last queue refresh: {updatedAt.toLocaleString()}
        </p>
      )}

      <p className="dispatcher-monitoring-note">
        FIFO uses request time among confirmed, unallocated
        arrivals. Future-date trips cannot depart early.
        Returning vans need a new confirmed arrival before
        receiving another allocation.
      </p>

      {error && (
        <p className="dispatcher-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="dispatcher-review-success" role="status">
          {message}
        </p>
      )}

      {loading && (
        <p role="status">Loading queue...</p>
      )}

      {queue?.days
        .filter((day) => day.travel_date > queue.today)
        .map((day) => (
          <p
            className="dispatcher-monitoring-note"
            key={day.travel_date}
          >
            {formatDate(day.travel_date)}:
            {" "}{day.allocated_count}/{queue.daily_limit}
            {" "}allocated; {day.remaining_slots} remaining.
          </p>
        ))}

      {!loading &&
        !error &&
        queue?.entries.length === 0 && (
          <p>
            No allocated trips. Confirm an arrival, then
            select Allocate Confirmed Arrivals.
          </p>
        )}

      <div className="dispatcher-queue-list">
        {queue?.entries.map((entry) => (
          <article
            className="dispatcher-queue-card"
            key={entry.id}
          >
            <header>
              <h3>
                #{entry.queue_number} · {entry.plate_number}
              </h3>

              <span>{entry.status}</span>
            </header>

            <dl>
              <div>
                <dt>Driver</dt>
                <dd>{entry.full_name}</dd>
              </div>

              <div>
                <dt>Travel Date</dt>
                <dd>{formatDate(entry.travel_date)}</dd>
              </div>

              <div>
                <dt>Waiting Position on Travel Date</dt>
                <dd>{entry.queue_position ?? "—"}</dd>
              </div>

              <div>
                <dt>Arrival Request</dt>
                <dd>#{entry.request_id}</dd>
              </div>

              <div>
                <dt>Departure</dt>
                <dd>{formatTime(entry.departed_at)}</dd>
              </div>

              <div>
                <dt>Completion</dt>
                <dd>{formatTime(entry.completed_at)}</dd>
              </div>
            </dl>

            {entry.status === "waiting" && (
              <button
                type="button"
                className="dispatcher-login-button"
                disabled={
                  blocked ||
                  entry.id !== queue.next_departure_id
                }
                onClick={() =>
                  handleAction(
                    `/dispatcher/queue/${entry.id}/depart`,
                    `Record departure for ${entry.plate_number}, queue #${entry.queue_number}?`
                  )
                }
              >
                {entry.travel_date > queue.today
                  ? "Scheduled for Future Date"
                  : entry.id === queue.next_departure_id
                    ? "Record Departure"
                    : "Waiting for Earlier Van"}
              </button>
            )}

            {entry.status === "departed" && (
              <button
                type="button"
                className="dispatcher-login-button"
                disabled={blocked}
                onClick={() =>
                  handleAction(
                    `/dispatcher/queue/${entry.id}/complete`,
                    `Confirm that ${entry.plate_number} has completed the trip and returned?`
                  )
                }
              >
                Complete Returned Trip
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default Jessie_QueueDispatch;
import { useEffect, useRef, useState } from "react";
import "./dispatcherEta.css";

const readResponse = async (response) => {
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.eta) {
    throw new Error(
      result?.message || "Unable to retrieve ETA information."
    );
  }

  return result;
};

const formatTime = (value) => {
  if (!value) return "Unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
};

const Jessie_TripEta = ({
  queueId,
  tripStatus,
  refreshKey,
  disabled,
  embedded = false,
}) => {
  const actionRef = useRef(false);
  const requestRef = useRef(null);

  const [open, setOpen] = useState(embedded);
  const [eta, setEta] = useState(null);
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [clock, setClock] = useState(null);
  const [now, setNow] = useState(Date.now());

  const receiveEta = (value) => {
    setEta(value);
    setDuration(value.estimated_duration_minutes ?? "");
    setClock({
      server: Date.parse(value.retrieved_at),
      received: Date.now(),
    });
    setNow(Date.now());
  };

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = window.setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      setEta(null);

      try {
        const response = await fetch(
          `/dispatcher/queue/${queueId}/eta`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await readResponse(response);

        if (!controller.signal.aborted) {
          receiveEta(result.eta);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [open, queueId, tripStatus, refreshKey, refreshCount]);

  const save = async (event) => {
    event.preventDefault();

    if (
      actionRef.current ||
      disabled ||
      loading ||
      !eta ||
      !["waiting", "departed"].includes(tripStatus) ||
      !["waiting", "departed"].includes(eta.trip_status)
    ) {
      return;
    }

    actionRef.current = true;

    const controller = new AbortController();
    requestRef.current = controller;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/dispatcher/queue/${queueId}/eta`,
        {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "X-EasyRide-Request": "1",
          },
          body: JSON.stringify({
            estimated_duration_minutes: Number(duration),
            revision: eta.revision,
          }),
        }
      );

      const result = await readResponse(response);

      if (!controller.signal.aborted) {
        receiveEta(result.eta);
        setMessage(result.message);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setEta(null);
        setError(
          requestError instanceof TypeError
            ? "Connection interrupted. Refresh ETA before retrying; the change may already have been saved."
            : requestError.message
        );
      }
    } finally {
      actionRef.current = false;

      if (!controller.signal.aborted) {
        setSaving(false);
      }
    }
  };

  const busy = loading || saving;

  const editable =
    eta &&
    ["waiting", "departed"].includes(tripStatus) &&
    ["waiting", "departed"].includes(eta.trip_status);

  const blocked = Boolean(disabled) || busy || !editable;

  const serverNow = clock
    ? clock.server + (now - clock.received)
    : NaN;

  const expired =
    eta?.status === "estimated" &&
    serverNow >= Date.parse(eta.estimated_arrival_at);

  const state = expired ? "outdated" : eta?.status;

  const stateLabel =
    state === "estimated"
      ? "Estimate"
      : state === "outdated"
        ? "Outdated estimate"
        : state === "inactive"
          ? "Inactive — trip completed"
          : "ETA unavailable";

  const reason = expired
    ? "The estimated arrival time has passed. Review the travel duration; arrival is not confirmed."
    : eta?.reason;

  return (
    <section
      className="dispatcher-eta"
      aria-label="Trip arrival estimate"
      aria-busy={busy}
    >
      {!embedded && (
<button
        type="button"
        className="dispatcher-queue-refresh"
        disabled={busy}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide ETA" : "Manage / View ETA"}
      </button>
      )}

      {open && (
        <div className="dispatcher-eta-content">
          <h4>Estimated Arrival in Pasay</h4>

          {loading && <p role="status">Loading ETA...</p>}

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

          {eta && (
            <>
              <p>
                <strong>{eta.origin}</strong> to{" "}
                <strong>{eta.destination}</strong>
              </p>

              <p>Route: {eta.route_description}</p>

              <p
                className={
                  state === "outdated"
                    ? "dispatcher-eta-outdated"
                    : ""
                }
              >
                <strong>{stateLabel}</strong>
              </p>

              {(state === "estimated" || state === "outdated") && (
                <p>
                  Estimated arrival:{" "}
                  <strong>
                    {formatTime(eta.estimated_arrival_at)}
                  </strong>
                </p>
              )}

              <p>{reason}</p>
              <p>Departure: {formatTime(eta.departed_at)}</p>

              <p>
                Estimated duration:{" "}
                {eta.estimated_duration_minutes === null
                  ? "Not set"
                  : `${eta.estimated_duration_minutes} minutes`}
              </p>

              <p>
                Duration last updated: {formatTime(eta.updated_at)}
              </p>

              {eta.calculated_at && (
                <p>
                  Calculation time: {formatTime(eta.calculated_at)}
                </p>
              )}

              <p>
                Times are shown in Philippine time.
                Travel time may vary due to traffic.
                This is a dispatcher estimate, not live traffic tracking.
              </p>

              {editable && (
                <form onSubmit={save}>
                  <label htmlFor={`eta-duration-${queueId}`}>
                    Estimated Travel Duration (minutes)
                  </label>

                  <div className="dispatcher-eta-controls">
                    <input
                      id={`eta-duration-${queueId}`}
                      type="number"
                      min="1"
                      max="65535"
                      step="1"
                      required
                      value={duration}
                      disabled={blocked}
                      onChange={(event) =>
                        setDuration(event.target.value)
                      }
                    />

                    <button
                      type="submit"
                      className="dispatcher-queue-refresh"
                      disabled={blocked}
                    >
                      Save Estimated Duration
                    </button>
                  </div>

                  <p>
                    Enter the total estimated travel time from
                    departure in Balayan to arrival in Pasay.
                  </p>
                </form>
              )}
            </>
          )}

          <button
            type="button"
            className="dispatcher-queue-refresh"
            disabled={busy || disabled}
            onClick={() => {
              setMessage("");
              setRefreshCount((count) => count + 1);
            }}
          >
            Refresh ETA
          </button>
        </div>
      )}
    </section>
  );
};

export default Jessie_TripEta;

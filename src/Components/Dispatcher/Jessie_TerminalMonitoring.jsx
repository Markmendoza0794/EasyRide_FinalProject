import { useEffect, useState } from "react";

const formatTime = (value) => {
  if (!value) return "Not yet confirmed";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
};

const readResponse = async (response) => {
  const result = await response.json().catch(() => null);

  if (!result) {
    throw new Error(
      "Invalid server response. Check the backend and Vite proxy."
    );
  }

  if (!response.ok) {
    throw new Error(result.message || "Request failed.");
  }

  return result;
};

const Jessie_TerminalMonitoring = () => {
  // Display threshold only; this does not confirm physical presence.
  const freshLocationSeconds = 60;
  const [now, setNow] = useState(Date.now());
  const [arrivals, setArrivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [reviews, setReviews] = useState({});
  const [reviewingId, setReviewingId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadArrivals = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/dispatcher/arrivals", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readResponse(response);

        if (!Array.isArray(result.arrivals)) {
          throw new Error("Arrival list is missing.");
        }

        if (!controller.signal.aborted) {
          setArrivals(result.arrivals);
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

    loadArrivals();

    return () => controller.abort();
  }, [refreshCount]);

  const updateReview = (requestId, field, value) => {
    setReviews((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        [field]: value,
      },
    }));
  };

  const handleReview = async (requestId, decision) => {
    if (reviewingId !== null || loading) return;

    const review = reviews[requestId] || {};
    const note = (review.note || "").trim();

    setError("");
    setMessage("");

    if (
      decision === "confirmed" &&
      review.terminalPresenceVerified !== true
    ) {
      setError(
        "Verify terminal presence using the checkbox before confirming."
      );
      return;
    }

    if (decision === "rejected" && !note) {
      setError("Please enter a reason for rejection.");
      return;
    }

    setReviewingId(requestId);

    try {
      const response = await fetch(
        `/dispatcher/arrivals/${requestId}/review`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-EasyRide-Request": "1",
          },
          body: JSON.stringify({
            decision,
            note,
            terminalPresenceVerified:
              review.terminalPresenceVerified === true,
          }),
        }
      );

      const result = await readResponse(response);

      setMessage(result.message);
      setReviews((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });

      // Immediately remove the old pending actions.
      setArrivals((current) =>
        decision === "rejected"
          ? current.filter(
              (arrival) => arrival.request_id !== requestId
            )
          : current.map((arrival) =>
              arrival.request_id === requestId
                ? { ...arrival, status: "confirmed" }
                : arrival
            )
      );

      setRefreshCount((count) => count + 1);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Cannot connect to the backend. Refresh the list before retrying."
          : requestError.message
      );
    } finally {
      setReviewingId(null);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const busy = loading || reviewingId !== null;

  return (
    <section
      className="dispatcher-monitoring"
      aria-labelledby="terminal-monitoring-title"
      aria-busy={busy}
    >
      <header className="dispatcher-monitoring-header">
        <div>
          <p className="dispatcher-eyebrow">
            TERMINAL OPERATIONS
          </p>

          <h2 id="terminal-monitoring-title">
            Active Arrival Requests
          </h2>

          <p>Review pending and confirmed driver arrivals.</p>
        </div>

        <button
          type="button"
          className="dispatcher-login-button"
          disabled={busy}
          onClick={() => {
            setMessage("");
            setRefreshCount((count) => count + 1);
          }}
        >
          {loading ? "Loading..." : "Refresh Arrivals"}
        </button>
      </header>

      {updatedAt && (
        <p className="dispatcher-monitoring-note">
          Last successful refresh: {updatedAt.toLocaleString()}
        </p>
      )}

      <p className="dispatcher-monitoring-note">
        Submitted coordinates are saved with the request. Latest GPS
        shows the last location retrieved using Refresh Arrivals.
        GPS is marked stale after 60 seconds. Confirm only after
        checking the driver and vehicle physically at the terminal.
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
        <p role="status">Loading arrival requests...</p>
      )}

      {!loading && !error && arrivals.length === 0 && (
        <p>No active arrival requests.</p>
      )}

      <div className="dispatcher-arrival-grid">
        {arrivals.map((arrival) => {
          const latest = arrival.latest_location;
          const recordedAt = latest ? Date.parse(latest.recorded_at) : NaN;
          const ageSeconds = (now - recordedAt) / 1000;
          const validTime = Number.isFinite(ageSeconds) && ageSeconds >= 0;
          const presence = arrival.terminal_presence;
          const ageLimit = presence?.max_location_age_seconds ?? freshLocationSeconds;
          const presenceExpired = latest && (!validTime || ageSeconds > ageLimit);
          const presenceStatus = presenceExpired ? "unavailable" : presence?.status;
          const presenceLabel = presenceStatus === "inside"
            ? "Inside terminal boundary"
            : presenceStatus === "outside"
              ? "Outside terminal boundary"
              : "Cannot determine terminal presence";
          const presenceReason = presenceExpired
            ? "Saved GPS reading is stale or its timestamp is invalid. Refresh to retrieve the latest reading."
            : presence?.reason || "Terminal presence information is unavailable.";
          const locationStatus = !latest
            ? "No saved GPS"
            : !validTime
              ? "GPS time unavailable"
              : ageSeconds <= freshLocationSeconds
                ? "Recent saved GPS"
                : "Stale saved GPS";
          const review = reviews[arrival.request_id] || {};
          const processing =
            reviewingId === arrival.request_id;

          return (
            <article
              className="dispatcher-arrival-card"
              key={arrival.request_id}
            >
              <header className="dispatcher-arrival-card-header">
                <h3>{arrival.full_name}</h3>

                <span className="dispatcher-arrival-status">
                  {arrival.status}
                </span>
              </header>

              <dl className="dispatcher-arrival-details">
                <div>
                  <dt>Request Number</dt>
                  <dd>{arrival.request_id}</dd>
                </div>

                <div>
                  <dt>Plate Number</dt>
                  <dd>{arrival.plate_number}</dd>
                </div>

                <div>
                  <dt>Contact Number</dt>
                  <dd>{arrival.contact_number}</dd>
                </div>

                <div>
                  <dt>Requested At</dt>
                  <dd>{formatTime(arrival.requested_at)}</dd>
                </div>

                <div>
                  <dt>Submitted Latitude</dt>
                  <dd>{arrival.latitude}</dd>
                </div>

                <div>
                  <dt>Submitted Longitude</dt>
                  <dd>{arrival.longitude}</dd>
                </div>

                <div>
                  <dt>Reported Accuracy</dt>
                  <dd>{arrival.accuracy_meters} meters</dd>
                </div>

                <div>
                  <dt>Distance at Submission</dt>
                  <dd>
                    {Number(arrival.distance_meters).toFixed(1)}
                    {" "}meters
                  </dd>
                </div>

                <div>
                  <dt>Location Recorded At</dt>
                  <dd>
                    {formatTime(arrival.location_recorded_at)}
                  </dd>
                </div>

                <div>
                  <dt>Confirmed At</dt>
                  <dd>{formatTime(arrival.confirmed_at)}</dd>
                </div>
              </dl>

              <section aria-label="Latest saved GPS">
                <h4>Latest Saved GPS</h4>
                <p><strong>GPS-based terminal presence: {presenceLabel}</strong></p>
                <p className="dispatcher-monitoring-note">{presenceReason}</p>
                <p className="dispatcher-monitoring-note">
                  GPS presence is separate from the reviewed arrival status.
                </p>
                <p className="dispatcher-monitoring-note">{locationStatus}</p>
                {latest && (
                  <dl className="dispatcher-arrival-details">
                    <div><dt>Latitude</dt><dd>{latest.latitude}</dd></div>
                    <div><dt>Longitude</dt><dd>{latest.longitude}</dd></div>
                    <div><dt>Reported Accuracy</dt><dd>{latest.accuracy_meters} meters</dd></div>
                    <div><dt>Last GPS Update</dt><dd>{formatTime(latest.recorded_at)}</dd></div>
                    <div><dt>Age of Saved GPS</dt><dd>{validTime ? `${Math.floor(ageSeconds)} seconds` : "Unavailable"}</dd></div>
                  </dl>
                )}
              </section>

              {arrival.status === "pending" && (
                <div className="dispatcher-review-form">
                  <label className="dispatcher-presence-check">
                    <input
                      type="checkbox"
                      checked={
                        review.terminalPresenceVerified === true
                      }
                      disabled={busy}
                      onChange={(event) =>
                        updateReview(
                          arrival.request_id,
                          "terminalPresenceVerified",
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      I verified that this driver and vehicle
                      are physically at the terminal.
                    </span>
                  </label>

                  <label
                    htmlFor={`review-note-${arrival.request_id}`}
                  >
                    Review note — required for rejection
                  </label>

                  <textarea
                    id={`review-note-${arrival.request_id}`}
                    value={review.note || ""}
                    maxLength={255}
                    rows={3}
                    disabled={busy}
                    onChange={(event) =>
                      updateReview(
                        arrival.request_id,
                        "note",
                        event.target.value
                      )
                    }
                    placeholder="Enter review details or rejection reason."
                  />

                  <div className="dispatcher-review-actions">
                    <button
                      type="button"
                      className="dispatcher-login-button"
                      disabled={
                        busy ||
                        review.terminalPresenceVerified !== true
                      }
                      onClick={() =>
                        handleReview(
                          arrival.request_id,
                          "confirmed"
                        )
                      }
                    >
                      {processing
                        ? "Processing..."
                        : "Confirm Arrival"}
                    </button>

                    <button
                      type="button"
                      className="dispatcher-reject-button"
                      disabled={busy}
                      onClick={() =>
                        handleReview(
                          arrival.request_id,
                          "rejected"
                        )
                      }
                    >
                      {processing
                        ? "Processing..."
                        : "Reject Request"}
                    </button>
                  </div>
                </div>
              )}

              {arrival.status === "confirmed" && (
                <p className="dispatcher-monitoring-note">
                  Terminal arrival confirmed. Queue assignment
                  is handled separately.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default Jessie_TerminalMonitoring;

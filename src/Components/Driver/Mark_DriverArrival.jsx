import { useEffect, useRef, useState } from "react";
import Mark_DriverQueue from "./Mark_DriverQueue";

const readArrivalResponse = async (response) => {
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

const formatArrivalTime = (value) => {
  if (!value) return "Not yet confirmed";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
};

const getFreshLocation = (signal) => {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(
        new DOMException("Request cancelled.", "AbortError")
      );
      return;
    }

    if (!window.isSecureContext) {
      reject(
        new Error("Location access requires HTTPS or localhost.")
      );
      return;
    }

    if (!navigator.geolocation) {
      reject(
        new Error(
          "This browser does not support location access."
        )
      );
      return;
    }

    let watchId;
    let timer;
    let bestLocation = null;
    let finished = false;
    let lastError = "Unable to retrieve your device location.";

    const finish = (location, requestError) => {
      if (finished) return;

      finished = true;
      window.clearTimeout(timer);

      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }

      signal.removeEventListener("abort", cancel);

      if (requestError) {
        reject(requestError);
      } else {
        resolve(location);
      }
    };

    const cancel = () => {
      finish(
        null,
        new DOMException("Request cancelled.", "AbortError")
      );
    };

    signal.addEventListener("abort", cancel, { once: true });

    timer = window.setTimeout(() => {
      if (bestLocation) {
        finish(bestLocation);
      } else {
        finish(null, new Error(lastError));
      }
    }, 25000);

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (finished) return;

          const { latitude, longitude, accuracy } =
            position.coords;

          if (
            !Number.isFinite(latitude) ||
            Math.abs(latitude) > 90 ||
            !Number.isFinite(longitude) ||
            Math.abs(longitude) > 180 ||
            !Number.isFinite(accuracy) ||
            accuracy < 0
          ) {
            return;
          }

          const reading = {
            latitude,
            longitude,
            accuracy,
          };

          if (
            !bestLocation ||
            accuracy < bestLocation.accuracy
          ) {
            bestLocation = reading;
          }

          // Current target only; the backend validates eligibility.
          if (accuracy <= 100) {
            finish(reading);
          }
        },
        (gpsError) => {
          if (finished) return;

          if (gpsError.code === 1) {
            finish(
              null,
              new Error(
                "Location permission denied. Allow location access in your browser and device settings."
              )
            );
            return;
          }

          lastError =
            gpsError.code === 2
              ? "Device location is unavailable. Check your location settings and try again."
              : "Location request timed out. Please try again.";
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }
      );

      if (finished && watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    } catch (requestError) {
      finish(null, requestError);
    }
  });
};

const Mark_DriverArrival = () => {
  const requestInProgress = useRef(false);
  const actionController = useRef(null);

  const [arrival, setArrival] = useState(null);
  const [queueRefreshCount, setQueueRefreshCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadArrival = async () => {
      try {
        const response = await fetch(
          "/driver/arrival-request",
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await readArrivalResponse(response);

        if (!controller.signal.aborted) {
          setArrival(result.arrival);
          setQueueRefreshCount((count) => count + 1);
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

    loadArrival();

    return () => {
      controller.abort();
      actionController.current?.abort();
    };
  }, []);

  const refreshStatus = async () => {
    if (loading || requestInProgress.current) return;

    requestInProgress.current = true;

    const controller = new AbortController();
    actionController.current = controller;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/driver/arrival-request",
        {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const result = await readArrivalResponse(response);

      if (!controller.signal.aborted) {
        setArrival(result.arrival);
        setQueueRefreshCount((count) => count + 1);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError.message);
      }
    } finally {
      requestInProgress.current = false;

      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleRequest = async (requestType) => {
    if (loading || requestInProgress.current) return;

    if (
      requestType === "submit" &&
      arrival?.is_active
    ) {
      return;
    }

    requestInProgress.current = true;

    const controller = new AbortController();
    actionController.current = controller;

    setAction(requestType);
    setError("");
    setAccuracy(null);

    setMessage(
      "Getting a fresh location. Waiting up to 25 seconds for a more accurate reading..."
    );

    let submittingArrival = false;

    try {
      const reading = await getFreshLocation(
        controller.signal
      );

      setAccuracy(reading.accuracy);
      setMessage("Saving your fresh location...");

      const locationResponse = await fetch(
        "/driver/location",
        {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "X-EasyRide-Request": "1",
          },
          body: JSON.stringify(reading),
        }
      );

      await readArrivalResponse(locationResponse);

      setMessage(
        requestType === "submit"
          ? "Checking terminal eligibility and submitting your arrival request..."
          : "Checking your location against the terminal requirements..."
      );

      submittingArrival = requestType === "submit";

      const response = await fetch(
        submittingArrival
          ? "/driver/arrival-request"
          : "/driver/arrival-check",
        {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "X-EasyRide-Request": "1",
          },
        }
      );

      const result = await readArrivalResponse(response);

      if (!controller.signal.aborted) {
        if (submittingArrival) {
          setArrival(result.arrival);
          setQueueRefreshCount((count) => count + 1);
        }

        setMessage(
          result.message ||
            (submittingArrival
              ? "Arrival request submitted. Please wait for dispatcher confirmation."
              : "Your location passed the terminal check.")
        );
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setMessage("");

        setError(
          requestError instanceof TypeError
            ? submittingArrival
              ? "The submission could not be confirmed. Use Refresh Status before submitting again."
              : "Cannot connect to the backend. Please check your connection."
            : requestError.message
        );
      }
    } finally {
      requestInProgress.current = false;

      if (!controller.signal.aborted) {
        setAction("");
      }
    }
  };

  const busy = loading || action !== "";

  return (
    <section
      className="driver-location-panel"
      aria-busy={busy}
    >
      <h2>Terminal Arrival Request</h2>

      <p>
        Check or submit to get a fresh device location
        automatically. Allow location access and keep
        this window open while checking.
      </p>

      {loading && (
        <p role="status">Loading arrival status...</p>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p role="status">{message}</p>
      )}

      {accuracy !== null && (
        <p>
          Device-reported accuracy: {Math.ceil(accuracy)}
          {" "}meters. Saving a location does not confirm
          terminal arrival.
        </p>
      )}

      {arrival ? (
        <dl className="driver-profile-details">
          <dt>Request Number</dt>
          <dd>{arrival.id}</dd>

          <dt>Status</dt>
          <dd>{arrival.status}</dd>

          <dt>Requested At</dt>
          <dd>
            {formatArrivalTime(arrival.requested_at)}
          </dd>

          <dt>Confirmed At</dt>
          <dd>
            {formatArrivalTime(arrival.confirmed_at)}
          </dd>
        </dl>
      ) : (
        !loading && <p>No arrival request yet.</p>
      )}

      <Mark_DriverQueue
        arrivalId={arrival?.id ?? null}
        arrivalStatus={arrival?.status ?? null}
        refreshKey={queueRefreshCount}
        onRefresh={refreshStatus}
        busy={busy}
      />

      <div className="driver-arrival-actions">
        <button
          type="button"
          className="auth-back"
          disabled={busy}
          onClick={() => handleRequest("check")}
        >
          {action === "check"
            ? "Getting Location and Checking..."
            : "Check Terminal Location"}
        </button>

        <button
          type="button"
          className="auth-submit"
          disabled={busy || Boolean(arrival?.is_active)}
          onClick={() => handleRequest("submit")}
        >
          {action === "submit"
            ? "Getting Location and Submitting..."
            : arrival?.is_active
              ? "Arrival Request Active"
              : "Submit Arrival Request"}
        </button>

        <button
          type="button"
          className="auth-back"
          disabled={busy}
          onClick={refreshStatus}
        >
          Refresh Status
        </button>
      </div>

      <p>
        Submitting a request does not automatically confirm
        arrival or assign a queue number.
      </p>
    </section>
  );
};

export default Mark_DriverArrival;
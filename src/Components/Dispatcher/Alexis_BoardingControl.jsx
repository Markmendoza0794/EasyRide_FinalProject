import { useEffect, useRef, useState } from "react";
import "../Passenger/passengerAvailability.css";

const readResponse = async (response) => {
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.boarding) {
    throw new Error(
      result?.message || "Unable to load boarding status."
    );
  }

  return result;
};

const Alexis_BoardingControl = ({
  queueId,
  refreshKey,
  disabled,
  onChange,
  onBusyChange,
}) => {
  const [boarding, setBoarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const busyRef = useRef(false);
  const mounted = useRef(false);
  const mutation = useRef(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      mutation.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      15000
    );

    setLoading(true);
    setError("");
    setBoarding(null);

    const load = async () => {
      try {
        const response = await fetch(
          `/dispatcher/queue/${queueId}/boarding`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await readResponse(response);

        if (active) setBoarding(result.boarding);
      } catch (requestError) {
        if (active) {
          setError(
            requestError.name === "AbortError"
              ? "Boarding request timed out. Refresh the status."
              : requestError.message
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [queueId, refreshKey, reload]);

  const toggleBoarding = async () => {
    if (
      disabled ||
      loading ||
      saving ||
      busyRef.current ||
      !boarding
    ) return;

    busyRef.current = true;
    setSaving(true);
    setError("");
    onBusyChange?.(true);

    const controller = new AbortController();
    mutation.current = controller;

    const timeout = window.setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const response = await fetch(
        `/dispatcher/queue/${queueId}/boarding`,
        {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "X-EasyRide-Request": "1",
          },
          body: JSON.stringify({
            is_boarding: !boarding.is_boarding,
            revision: boarding.revision,
          }),
        }
      );

      const result = await readResponse(response);

      if (mounted.current) {
        setBoarding(result.boarding);
        onChange?.();
      }
    } catch (requestError) {
      if (mounted.current) {
        setBoarding(null);
        setError(
          requestError.name === "AbortError" ||
          requestError instanceof TypeError
            ? "Connection interrupted. Refresh the status before retrying; the update may have completed."
            : requestError.message
        );
      }
    } finally {
      window.clearTimeout(timeout);
      mutation.current = null;
      busyRef.current = false;

      if (mounted.current) setSaving(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div
      className="dispatcher-boarding-control"
      aria-busy={loading || saving}
    >
      {loading ? (
        <p role="status">Loading boarding status...</p>
      ) : error ? (
        <>
          <p className="dispatcher-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="dispatcher-queue-refresh"
            disabled={disabled || saving}
            onClick={() => setReload((value) => value + 1)}
          >
            Refresh Boarding
          </button>
        </>
      ) : boarding && (
        <>
          <p role="status">
            Boarding: {boarding.is_boarding ? "Open" : "Closed"}
          </p>
          <button
            type="button"
            className="dispatcher-queue-refresh"
            disabled={
              disabled ||
              saving ||
              boarding.trip_status !== "waiting"
            }
            onClick={toggleBoarding}
          >
            {saving
              ? "Saving..."
              : boarding.is_boarding
                ? "Stop Boarding"
                : "Start Boarding"}
          </button>
        </>
      )}
    </div>
  );
};

export default Alexis_BoardingControl;

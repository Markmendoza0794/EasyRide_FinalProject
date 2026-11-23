import { useEffect, useRef, useState } from "react";
import "./dispatcherSeats.css";

const readResponse = async (response) => {
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.seats) {
    throw new Error(
      result?.message || "Unable to retrieve seat information."
    );
  }

  return result;
};

const Jessie_SeatManagement = ({
  queueId,
  tripStatus,
  refreshKey,
  disabled,
}) => {
  const actionRef = useRef(false);
  const requestRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(null);
  const [capacity, setCapacity] = useState("");
  const [occupiedCount, setOccupiedCount] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      setSeats(null);

      try {
        const response = await fetch(
          `/dispatcher/queue/${queueId}/seats`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await readResponse(response);

        if (!controller.signal.aborted) {
          setSeats(result.seats);
          setCapacity(result.seats.passenger_capacity ?? "");
          setOccupiedCount(result.seats.occupied_count);
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

  const refresh = () => {
    setMessage("");
    setRefreshCount((count) => count + 1);
  };

  const save = async (operation, values) => {
    if (
      actionRef.current ||
      loading ||
      disabled ||
      !seats ||
      tripStatus !== "waiting" ||
      seats.trip_status !== "waiting"
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
        `/dispatcher/queue/${queueId}/seats/${operation}`,
        {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "X-EasyRide-Request": "1",
          },
          body: JSON.stringify({
            ...values,
            revision: seats.revision,
          }),
        }
      );

      const result = await readResponse(response);

      if (!controller.signal.aborted) {
        setSeats(result.seats);
        setCapacity(result.seats.passenger_capacity ?? "");
        setOccupiedCount(result.seats.occupied_count);
        setMessage(result.message);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setSeats(null);

        setError(
          requestError instanceof TypeError
            ? "Connection interrupted. Refresh seats before retrying; the change may already have been saved."
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
    seats &&
    tripStatus === "waiting" &&
    seats.trip_status === "waiting";

  const blocked = Boolean(disabled) || busy || !editable;

  return (
    <section
      className="dispatcher-seats"
      aria-label="Trip seat management"
      aria-busy={busy}
    >
      <button
        type="button"
        className="dispatcher-queue-refresh"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide Seats" : "Manage / View Seats"}
      </button>

      {open && (
        <div className="dispatcher-seats-content">
          <h4>Passenger Seats</h4>

          {loading && (
            <p role="status">Loading seats...</p>
          )}

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

          {seats && (
            <>
              <p>
                Capacity:{" "}
                <strong>
                  {seats.passenger_capacity ?? "Not set"}
                </strong>
                {" · "}Passenger Count:{" "}
                <strong>{seats.occupied_count}</strong>
                {" · "}Available Seats:{" "}
                <strong>
                  {seats.available_seats ?? "Not set"}
                </strong>
              </p>

              {seats.available_seats === 0 && (
                <p role="status">
                  <strong>Full — no available seats.</strong>
                </p>
              )}

              {!editable && (
                <p>
                  Passenger records are read-only after departure.
                </p>
              )}

              {editable && (
                <>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();

                      save("capacity", {
                        passenger_capacity: Number(capacity),
                      });
                    }}
                  >
                    <label htmlFor={`capacity-${queueId}`}>
                      Passenger Capacity (excluding driver)
                    </label>

                    <div className="dispatcher-seat-controls">
                      <input
                        id={`capacity-${queueId}`}
                        type="number"
                        min="1"
                        max="65535"
                        step="1"
                        required
                        value={capacity}
                        disabled={blocked}
                        onChange={(event) =>
                          setCapacity(event.target.value)
                        }
                      />

                      <button
                        type="submit"
                        className="dispatcher-queue-refresh"
                        disabled={blocked}
                      >
                        Save Capacity
                      </button>
                    </div>
                  </form>

                  {seats.passenger_capacity !== null && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();

                        save("assignment", {
                          occupied_count: Number(occupiedCount),
                        });
                      }}
                    >
                      <label htmlFor={`occupied-count-${queueId}`}>
                        Passenger Count
                      </label>

                      <div className="dispatcher-seat-controls">
                        <input
                          id={`occupied-count-${queueId}`}
                          type="number"
                          min="0"
                          max={seats.passenger_capacity}
                          step="1"
                          required
                          value={occupiedCount}
                          disabled={blocked}
                          onChange={(event) =>
                            setOccupiedCount(event.target.value)
                          }
                        />

                        <button
                          type="submit"
                          className="dispatcher-queue-refresh"
                          disabled={blocked}
                        >
                          Save Passenger Count
                        </button>
                      </div>

                      <p>
                        Enter the total number of passengers currently on board. Enter 0 when empty.
                      </p>
                    </form>
                  )}
                </>
              )}
            </>
          )}

          <button
            type="button"
            className="dispatcher-queue-refresh"
            disabled={busy || disabled}
            onClick={refresh}
          >
            Refresh Seats
          </button>
        </div>
      )}
    </section>
  );
};

export default Jessie_SeatManagement;
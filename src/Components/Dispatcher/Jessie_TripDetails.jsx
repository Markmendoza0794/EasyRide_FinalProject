import { useEffect, useRef, useState } from "react";
import Jessie_SeatManagement from "./Jessie_SeatManagement";
import Jessie_TripEta from "./Jessie_TripEta";
import "./dispatcherTripDetails.css";

const formatTime = (value) => {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
      });
};

const Jessie_TripDetails = ({
  entry,
  refreshKey,
  disabled,
  expanded,
  onToggle,
}) => {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  const [activeTab, setActiveTab] = useState(
    entry.status === "departed" ? "eta" : "seats"
  );

  useEffect(() => {
    if (!expanded) return;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    if (!dialog.open) {
      dialog.showModal();
    }

    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      document.body.style.overflow = previousOverflow;

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [expanded]);

  return (
    <>
      <button
        type="button"
        className="dispatcher-queue-refresh dispatcher-trip-toggle"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={`trip-details-${entry.id}`}
        onClick={onToggle}
      >
        Trip Details
      </button>

      <dialog
        ref={dialogRef}
        id={`trip-details-${entry.id}`}
        className="dispatcher-trip-dialog"
        aria-labelledby={`trip-heading-${entry.id}`}
        onCancel={(event) => {
          event.preventDefault();
          onToggle();
        }}
      >
        {expanded && (
          <>
            <header className="dispatcher-trip-dialog-header">
              <div>
                <h2 id={`trip-heading-${entry.id}`}>
                  #{entry.queue_number} · {entry.plate_number}
                </h2>
                <p>
                  {entry.full_name} · {entry.status}
                </p>
              </div>

              <button
                ref={closeRef}
                type="button"
                className="dispatcher-queue-refresh"
                onClick={onToggle}
              >
                Close
              </button>
            </header>

            <div className="dispatcher-trip-panel dispatcher-trip-dialog-body">
              <div
                className="dispatcher-trip-tabs"
                role="group"
                aria-label="Trip detail sections"
              >
                <button
                  type="button"
                  aria-pressed={activeTab === "seats"}
                  disabled={disabled}
                  onClick={() => setActiveTab("seats")}
                >
                  Seats
                </button>

                <button
                  type="button"
                  aria-pressed={activeTab === "eta"}
                  disabled={disabled}
                  onClick={() => setActiveTab("eta")}
                >
                  ETA
                </button>
              </div>

              {activeTab === "seats" ? (
                <Jessie_SeatManagement
                  queueId={entry.id}
                  tripStatus={entry.status}
                  refreshKey={refreshKey}
                  disabled={disabled}
                  embedded
                />
              ) : (
                <Jessie_TripEta
                  queueId={entry.id}
                  tripStatus={entry.status}
                  refreshKey={refreshKey}
                  disabled={disabled}
                  embedded
                />
              )}

              <details className="dispatcher-trip-timestamps">
                <summary>Trip Records</summary>

                <dl className="dispatcher-trip-records">
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
              </details>
            </div>
          </>
        )}
      </dialog>
    </>
  );
};

export default Jessie_TripDetails;

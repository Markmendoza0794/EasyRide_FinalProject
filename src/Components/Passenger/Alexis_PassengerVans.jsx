import { useState } from "react";
import "./passengerAvailability.css";

const statusDetails = {
  waiting: [
    "Waiting",
    "Waiting for the dispatcher to open boarding.",
  ],
  boarding: [
    "Boarding",
    "Boarding is open. Please confirm your seat with terminal staff.",
  ],
  full: [
    "Full",
    "No available seats. Please ask terminal staff about the next van.",
  ],
  departed: [
    "Departed",
    "This van has left the terminal. Boarding is closed.",
  ],
  scheduled: [
    "Scheduled",
    "Scheduled for a future travel date. Boarding is closed.",
  ],
  unavailable: [
    "Information Unavailable",
    "Please ask terminal staff for current availability.",
  ],
};

const getGroup = (van) => {
  if (van.status === "departed") return "road";
  if (van.availability === "scheduled") return "scheduled";
  return "terminal";
};

const formatTime = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "Unavailable";
  }

  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
  });
};

const Alexis_PassengerVans = ({
  vans = [],
  loading = false,
  error = "",
  onBack,
  lastUpdated = "",
}) => {
  const [view, setView] = useState("terminal");

  const groups = [
    ["terminal", "At Terminal"],
    ["road", "On the Road"],
    ["scheduled", "Scheduled"],
  ];

  const visibleVans = vans.filter(
    (van) => getGroup(van) === view
  );

  const hasBoarding = vans.some(
    (van) =>
      van.availability === "boarding" &&
      van.can_board === true
  );

  return (
    <main className="passenger-seats-page">
      <header className="passenger-seats-header">
        <p className="passenger-eyebrow">
          EASYRIDE — BALAYAN UV EXPRESS
        </p>
        <h1>Van Availability</h1>
        <p>Balayan, Batangas to Pasay City via CALAX</p>

        <div className="passenger-actions">
          <button type="button" onClick={onBack}>
            Back to Home
          </button>

        </div>

        <p className="passenger-note">
          Check the van status before boarding.
          Seat counts do not reserve a seat.
        </p>

        {lastUpdated && !error && (
          <p className="passenger-note">
            Last updated: {lastUpdated} (Philippine time).
            Van information updates automatically.
          </p>
        )}
      </header>

      <div
        className="passenger-van-tabs"
        role="group"
        aria-label="Van lists"
      >
        {groups.map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label} ({
              vans.filter((van) => getGroup(van) === key).length
            })
          </button>
        ))}
      </div>

      {!loading && !error && view === "terminal" && !hasBoarding && (
        <p className="passenger-note">
          No vans are currently open for boarding.
          Please ask terminal staff for assistance.
        </p>
      )}

      <section
        className="passenger-seats-list"
        aria-label="Van availability"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <p className="passenger-message" role="status">
            Loading van information...
          </p>
        ) : error ? (
          <p
            className="passenger-message passenger-error"
            role="alert"
          >
            {error}
          </p>
        ) : visibleVans.length === 0 ? (
          <p className="passenger-message">
            {view === "terminal"
              ? "No waiting vans are currently listed."
              : view === "road"
                ? "No active departed trips are currently listed."
                : "No future trips are currently listed."}
          </p>
        ) : (
          visibleVans.map((van) => {
            const knownStatus = Object.hasOwn(
              statusDetails,
              van.availability
            );

            const status = knownStatus
              ? van.availability
              : "unavailable";

            const [label, explanation] = statusDetails[status];

            const validSeats =
              Number.isInteger(van.total_seats) &&
              van.total_seats > 0 &&
              Number.isInteger(van.occupied_seats) &&
              van.occupied_seats >= 0 &&
              van.occupied_seats <= van.total_seats &&
              van.available_seats ===
                van.total_seats - van.occupied_seats;

            return (
              <article
                className="passenger-seat-card"
                key={van.id}
              >
                <header>
                  <div>
                    <p className="passenger-note">
                      Queue #{van.queue_number}
                    </p>
                    <h2>{van.plate_number}</h2>
                  </div>
                  <span
                    className={
                      `passenger-van-badge passenger-van-${status}`
                    }
                  >
                    {label}
                  </span>
                </header>

                <p className="passenger-van-destination">
                  Destination: <strong>{van.destination}</strong>
                </p>
                <p className="passenger-note">
                  Route: {van.route_description}
                </p>
                <p className="passenger-note">
                  Travel date: {van.travel_date}
                </p>

                {view === "terminal" && (
                  validSeats ? (
                    <dl className="passenger-seat-counts">
                      <div>
                        <dt>Passenger Capacity</dt>
                        <dd>{van.total_seats}</dd>
                      </div>
                      <div>
                        <dt>Passenger Count</dt>
                        <dd>{van.occupied_seats}</dd>
                      </div>
                      <div>
                        <dt>Available Seats</dt>
                        <dd>{van.available_seats}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="passenger-note">
                      Seat information is unavailable.
                    </p>
                  )
                )}

                {view === "road" && (
                  <p className="passenger-note">
                    Departure: {formatTime(van.departed_at)}
                    {" "}(Philippine time)
                  </p>
                )}

                <p
                  className={
                    `passenger-status passenger-van-${status}`
                  }
                >
                  {explanation}
                </p>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
};

export default Alexis_PassengerVans;

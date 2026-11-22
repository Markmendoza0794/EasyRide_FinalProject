// Adapted from Alexis Samonteza's passenger interface, commit a977a88.
const Alexis_PassengerSeats = ({
  vans = [],
  loading = false,
  error = "",
  onBack,
  onRefresh,
  lastUpdated = "",
}) => {
  const hasVans = vans.length > 0;

  return (
    <main className="passenger-seats-page">
      <header className="passenger-seats-header">
        <p className="passenger-eyebrow">
          EASYRIDE — BALAYAN UV EXPRESS
        </p>
        <h1>Available Seats</h1>
        <p>Balayan, Batangas to Pasay City via CALAX</p>

        <div className="passenger-actions">
          {onBack && (
            <button type="button" onClick={onBack}>
              Back to Home
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Seats"}
            </button>
          )}
        </div>

        <p className="passenger-note">
          Shows waiting vans scheduled for today or earlier.
          Seat counts do not reserve a seat.
          Confirm boarding with terminal staff.
        </p>

        {lastUpdated && !error && (
          <p className="passenger-note">
            Last refreshed: {lastUpdated} (Philippine time).
            Refreshes automatically every 30 seconds while this page is visible.
          </p>
        )}
      </header>

      <section
        className="passenger-seats-list"
        aria-label="Van seat availability"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <p className="passenger-message" role="status">
            Loading seat information...
          </p>
        ) : error ? (
          <p className="passenger-message passenger-error" role="alert">
            {error}
          </p>
        ) : !hasVans ? (
          <p className="passenger-message">
            No waiting vans are currently listed.
            Please check again or ask terminal staff.
          </p>
        ) : (
          vans.map((van) => {
            const capacity = van.total_seats;
            const occupied = van.occupied_seats;

            const validSeats =
              Number.isInteger(capacity) &&
              Number.isInteger(occupied) &&
              capacity > 0 &&
              occupied >= 0 &&
              occupied <= capacity;

            const available = validSeats
              ? capacity - occupied
              : null;

            return (
              <article className="passenger-seat-card" key={van.id}>
                <header>
                  <div>
                    <p className="passenger-note">
                      Queue #{van.queue_number}
                    </p>
                    <h2>{van.plate_number}</h2>
                  </div>
                  <span className="passenger-waiting">Waiting</span>
                </header>

                <p className="passenger-note">
                  Travel date: {van.travel_date}
                </p>

                {validSeats ? (
                  <>
                    <dl className="passenger-seat-counts">
                      <div>
                        <dt>Passenger Capacity</dt>
                        <dd>{capacity}</dd>
                      </div>
                      <div>
                        <dt>Passenger Count</dt>
                        <dd>{occupied}</dd>
                      </div>
                      <div>
                        <dt>Available Seats</dt>
                        <dd>{available}</dd>
                      </div>
                    </dl>

                    <p className={
                      available === 0
                        ? "passenger-status passenger-status-full"
                        : "passenger-status passenger-status-available"
                    }>
                      {available === 0 ? "Full" : "Seats Available"}
                    </p>
                  </>
                ) : (
                  <p className="passenger-status">
                    Seat information is unavailable.
                    Please ask terminal staff.
                  </p>
                )}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
};

export default Alexis_PassengerSeats;

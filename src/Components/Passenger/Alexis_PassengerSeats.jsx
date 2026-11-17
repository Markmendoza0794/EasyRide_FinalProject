const Alexis_PassengerSeats = ({
  vans = [],
  loading = false,
  error = "",
  onBack,
}) => {
  const hasVans = vans.length > 0;

  return (
    <main className="passenger-seats-page">
      <header className="passenger-seats-header">
        <p>EASYRIDE — BALAYAN UV EXPRESS</p>
        <h1>Available Seats</h1>
        <p>Check the available seats for each van.</p>

        {onBack && (
          <button type="button" onClick={onBack}>
            Back to Home
          </button>
        )}
      </header>

      <section
        className="passenger-seats-list"
        aria-label="Van seat availability"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <p role="status">Loading seat information...</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : !hasVans ? (
          <p>No seat information is currently available.</p>
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
              <article
                className="passenger-seat-card"
                key={van.id}
              >
                <h2>{van.plate_number}</h2>

                {validSeats ? (
                  <>
                    <dl>
                      <div>
                        <dt>Total Seats</dt>
                        <dd>{capacity}</dd>
                      </div>

                      <div>
                        <dt>Available Seats</dt>
                        <dd>{available}</dd>
                      </div>
                    </dl>

                    <p
                      className={
                        available === 0
                          ? "seat-status seat-status-full"
                          : "seat-status seat-status-available"
                      }
                    >
                      {available === 0
                        ? "Full"
                        : "Seats Available"}
                    </p>
                  </>
                ) : (
                  <p>Seat information is unavailable.</p>
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
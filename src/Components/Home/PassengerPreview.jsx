import { useEffect, useRef, useState } from "react";
const labels = { waiting: "Waiting", boarding: "Boarding", full: "Full", departed: "Departed", scheduled: "Scheduled", unavailable: "Unavailable" };
const PassengerPreview = () => {
  const [vans, setVans] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");
  const refreshRef = useRef(null);
  useEffect(() => {
    let active = true;
    let running = false;
    let controller;
    const load = async () => {
      if (!active || running || document.hidden) return;
      running = true;
      controller = new AbortController();
      const requestController = controller;
      const timeout = window.setTimeout(() => requestController.abort(), 15000);
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/passenger/vans", { credentials: "omit", cache: "no-store", signal: requestController.signal });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.message || "Unable to retrieve van information.");
        if (!Array.isArray(result?.vans) || !Number.isFinite(Date.parse(result?.fetched_at))) throw new Error("Invalid van information received.");
        if (active) {
          setVans(result.vans);
          setUpdated(new Date(result.fetched_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }));
        }
      } catch (failure) {
        if (active) {
          setVans([]);
          setUpdated("");
          setError(failure.name === "AbortError" ? "The request timed out. The board will retry automatically." : failure instanceof TypeError ? "Cannot connect to the server. The board will retry automatically." : failure.message);
        }
      } finally {
        window.clearTimeout(timeout);
        running = false;
        if (active) setBusy(false);
      }
    };
    const visible = () => { if (!document.hidden) load(); };
    refreshRef.current = load;
    load();
    const interval = window.setInterval(load, 30000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      refreshRef.current = null;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return (
    <section className="er-board" id="terminal-board" aria-labelledby="er-board-title">
      <header className="er-board-heading">
        <div><p className="er-eyebrow">PASSENGER INFORMATION</p><h2 id="er-board-title">Terminal Board</h2><p>Current and scheduled vans for the Balayan to Pasay route.</p></div>

      </header>
      <p className="er-board-note" role="status">{updated ? `Last refreshed: ${updated} (Philippine time). ` : ""}Updates every 30 seconds while this page is visible.</p>
      {error ? <p className="er-board-error" role="alert">{error}</p> : busy && !updated ? <p role="status">Loading van information...</p> : vans.length === 0 ? <p className="er-empty">No active vans are currently listed. Please check again or ask terminal staff.</p> : (
        <div className="er-table-scroll" tabIndex={0} role="region" aria-label="Van availability table, scroll horizontally on smaller screens" aria-busy={busy}>
          <table className="er-table">
            <caption>Up to eight active or scheduled trips.</caption>
            <thead><tr><th scope="col">Queue</th><th scope="col">Van / Plate</th><th scope="col">Destination</th><th scope="col">Available Seats</th><th scope="col">Status</th></tr></thead>
            <tbody>{vans.slice(0, 8).map((van) => {
              const status = Object.hasOwn(labels, van.availability) ? van.availability : "unavailable";
              const knownSeats = !["departed", "scheduled", "unavailable"].includes(status) && Number.isInteger(van.total_seats) && van.total_seats > 0 && Number.isInteger(van.occupied_seats) && van.occupied_seats >= 0 && van.occupied_seats <= van.total_seats && van.available_seats === van.total_seats - van.occupied_seats;
              return <tr key={van.id}><td><strong>#{van.queue_number}</strong><small>{van.travel_date}</small></td><td><strong>{van.plate_number}</strong></td><td>{van.destination}</td><td>{knownSeats ? van.available_seats : "Unavailable"}</td><td><span className={`er-status er-status-${status}`}>{labels[status]}</span></td></tr>;
            })}</tbody>
          </table>
        </div>
      )}
      <div className="er-board-footer"><p>Seat counts are informational. Confirm boarding with terminal staff.</p></div>
    </section>
  );
};
export default PassengerPreview;

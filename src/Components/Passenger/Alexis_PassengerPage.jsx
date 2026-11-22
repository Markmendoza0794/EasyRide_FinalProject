import { useEffect, useRef, useState } from "react";
import Alexis_PassengerSeats from "./Alexis_PassengerSeats";
import "./passengerSeats.css";

const Alexis_PassengerPage = ({ onBack }) => {
  const [vans, setVans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const refreshRef = useRef(null);

  useEffect(() => {
    let active = true;
    let running = false;
    let controller = null;

    const loadSeats = async () => {
      if (!active || running || document.hidden) return;

      running = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);

      setLoading(true);
      setError("");

      try {
        const response = await fetch("/passenger/seats", {
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            result?.message || "Unable to load seat information."
          );
        }

        if (
          !Array.isArray(result?.vans) ||
          !Number.isFinite(Date.parse(result.fetched_at))
        ) {
          throw new Error("Invalid seat information received.");
        }

        if (!active) return;

        setVans(result.vans);
        setLastUpdated(
          new Date(result.fetched_at).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
          })
        );
      } catch (requestError) {
        if (!active) return;

        setVans([]);
        setLastUpdated("");
        setError(
          requestError.name === "AbortError"
            ? "The request timed out. Please refresh seats."
            : requestError instanceof TypeError
              ? "Cannot connect to the server. Please try again."
              : requestError.message
        );
      } finally {
        window.clearTimeout(timeout);
        running = false;

        if (active) setLoading(false);
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) loadSeats();
    };

    refreshRef.current = loadSeats;
    loadSeats();

    const interval = window.setInterval(loadSeats, 30000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      refreshRef.current = null;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      controller?.abort();
    };
  }, []);

  return (
    <Alexis_PassengerSeats
      vans={vans}
      loading={loading}
      error={error}
      lastUpdated={lastUpdated}
      onBack={onBack}
      onRefresh={() => refreshRef.current?.()}
    />
  );
};

export default Alexis_PassengerPage;

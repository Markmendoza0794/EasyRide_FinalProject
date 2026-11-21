import { useEffect, useRef, useState } from "react";
import Mark_DriverAuth from "./Mark_DriverAuth";
import Mark_DriverLocation from "./Mark_DriverLocation";
import Mark_DriverArrival from "./Mark_DriverArrival";

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

const DriverPopup = ({
  id,
  title,
  open,
  onClose,
  children,
}) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    const previousOverflow = document.body.style.overflow;

    if (!dialog.open) dialog.showModal();

    document.body.style.overflow = "hidden";

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleBackdropClick = (event) => {
    if (event.target !== event.currentTarget) return;

    const bounds = event.currentTarget.getBoundingClientRect();

    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className="driver-popup-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
    >
      <header className="driver-popup-heading">
        <h2 id={`${id}-title`}>{title}</h2>

        <button
          type="button"
          className="driver-popup-close"
          onClick={onClose}
          aria-label={`Close ${title}`}
          autoFocus
        >
          ×
        </button>
      </header>

      {children}
    </dialog>
  );
};

const Mark_DriverPortal = ({ onBack }) => {
  const [driver, setDriver] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const restoreSession = async () => {
      try {
        const response = await fetch("/driver/session", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) return;

        const result = await readResponse(response);

        if (!result.driver?.id) {
          throw new Error("Driver profile is missing.");
        }

        if (!controller.signal.aborted) {
          setDriver(result.driver);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    };

    restoreSession();

    return () => controller.abort();
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/driver/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-EasyRide-Request": "1",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      await readResponse(response);

      const sessionResponse = await fetch("/driver/session", {
        credentials: "include",
        cache: "no-store",
      });

      const result = await readResponse(sessionResponse);

      if (!result.driver?.id) {
        throw new Error("Driver profile is missing.");
      }

      setDriver(result.driver);
      setPassword("");
      setActivePanel("");
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Cannot connect to the backend."
          : requestError.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/driver/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-EasyRide-Request": "1",
        },
      });

      await readResponse(response);

      setDriver(null);
      setUsername("");
      setPassword("");
      setActivePanel("");
    } catch (requestError) {
      setError(requestError.message || "Unable to log out.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="driver-auth-page">
        <div className="driver-auth-card">
          <p role="status">Checking driver session...</p>
        </div>
      </main>
    );
  }

  if (driver) {
    return (
      <main className="driver-auth-page driver-dashboard-page">
        <section className="driver-auth-card driver-dashboard-card driver-dashboard-compact">
          <header className="driver-dashboard-heading">
            <div>
              <h1>EASYRIDE</h1>
              <p>Driver Dashboard</p>
            </div>

            <button
              type="button"
              className="driver-logout-button"
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? "Logging out..." : "Logout"}
            </button>
          </header>

          <h2 className="driver-welcome">
            Welcome, {driver.full_name}!
          </h2>

          <section
            className="driver-profile-card"
            aria-labelledby="driver-profile-title"
          >
            <h3 id="driver-profile-title">
              Driver and Vehicle Information
            </h3>

            <dl className="driver-compact-details">
              <div>
                <dt>Plate Number</dt>
                <dd>{driver.plate_number}</dd>
              </div>

              <div>
                <dt>Username</dt>
                <dd>{driver.username}</dd>
              </div>

              <div>
                <dt>Address</dt>
                <dd>{driver.address}</dd>
              </div>

              <div>
                <dt>Contact Number</dt>
                <dd>{driver.contact_number}</dd>
              </div>
            </dl>
          </section>

          <div
            className="driver-dashboard-actions"
            role="group"
            aria-label="Driver tools"
          >
            <button
              type="button"
              className="driver-tool-button"
              aria-haspopup="dialog"
              aria-controls="driver-gps-panel"
              onClick={() => setActivePanel("gps")}
            >
              <strong>GPS Location</strong>
              <span>Manage your location sharing</span>
            </button>

            <button
              type="button"
              className="driver-tool-button"
              aria-haspopup="dialog"
              aria-controls="driver-arrival-panel"
              onClick={() => setActivePanel("arrival")}
            >
              <strong>Terminal Arrival</strong>
              <span>Check your terminal location</span>
            </button>
          </div>

          <p className="driver-tools-note">
            Closing the GPS popup does not stop active
            location sharing. Open GPS Location to stop
            sharing.
          </p>

          <DriverPopup
            id="driver-gps-panel"
            title="GPS Location"
            open={activePanel === "gps"}
            onClose={() => setActivePanel("")}
          >
            <Mark_DriverLocation />
          </DriverPopup>

          <DriverPopup
            id="driver-arrival-panel"
            title="Terminal Arrival"
            open={activePanel === "arrival"}
            onClose={() => setActivePanel("")}
          >
            <Mark_DriverArrival />
          </DriverPopup>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (registerOpen) {
    return (
      <Mark_DriverAuth
        onBack={() => setRegisterOpen(false)}
      />
    );
  }

  return (
    <main className="driver-auth-page">
      <section className="driver-auth-card">
        <button
          type="button"
          className="auth-back"
          onClick={onBack}
          disabled={loading}
        >
          Back to Home
        </button>

        <header className="auth-header">
          <h1>EASYRIDE</h1>
          <p>Driver Login</p>
        </header>

        <form onSubmit={handleLogin}>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="auth-field">
            <label htmlFor="driver-login-username">
              Username
            </label>

            <input
              id="driver-login-username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              autoComplete="username"
              maxLength={100}
              disabled={loading}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="driver-login-password">
              Password
            </label>

            <input
              id="driver-login-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login as Driver"}
          </button>
        </form>

        <button
          type="button"
          className="auth-back driver-register-link"
          onClick={() => {
            setError("");
            setRegisterOpen(true);
          }}
          disabled={loading}
        >
          Create Driver Account
        </button>
      </section>
    </main>
  );
};

export default Mark_DriverPortal;
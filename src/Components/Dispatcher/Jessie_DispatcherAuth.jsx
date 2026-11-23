import { useEffect, useState } from "react";
import Jessie_TerminalMonitoring from "./Jessie_TerminalMonitoring";
import Jessie_QueueDispatch from "./Jessie_QueueDispatch";
import "./dispatcher.css";
import "./dispatcherWorkspace.css";

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

const loadDashboard = async (signal) => {
  const response = await fetch("/dispatcher/dashboard", {
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (response.status === 401) return null;

  const result = await readResponse(response);

  if (!result.dispatcher?.id) {
    throw new Error("Dispatcher information is missing.");
  }

  return result.dispatcher;
};

const Jessie_DispatcherAuth = ({ onBack }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dispatcher, setDispatcher] = useState(null);
  const [workspace, setWorkspace] = useState("queue");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const restoreSession = async () => {
      try {
        const currentDispatcher = await loadDashboard(
          controller.signal
        );

        if (!controller.signal.aborted) {
          setDispatcher(currentDispatcher);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingSession(false);
        }
      }
    };

    restoreSession();

    return () => controller.abort();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/dispatcher/login", {
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

      const currentDispatcher = await loadDashboard();

      if (!currentDispatcher) {
        throw new Error(
          "Session could not be restored. Please log in again."
        );
      }

      setDispatcher(currentDispatcher);
      setPassword("");
      window.scrollTo(0, 0);
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
      const response = await fetch("/dispatcher/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-EasyRide-Request": "1",
        },
      });

      await readResponse(response);

      setDispatcher(null);
      setWorkspace("queue");
      setUsername("");
      setPassword("");
    } catch (requestError) {
      setError(requestError.message || "Unable to log out.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="dispatcher-auth-page">
        <section className="dispatcher-auth-card">
          <p role="status">Checking dispatcher session...</p>
        </section>
      </main>
    );
  }

  if (dispatcher) {
    return (
      <main className="dispatcher-dashboard dispatcher-workspace">
        <header className="dispatcher-dashboard-header">
          <div>
            <p className="dispatcher-eyebrow">
              EASYRIDE TERMINAL OPERATIONS
            </p>
            <h1>Dispatcher Dashboard</h1>
            <p>Welcome, {dispatcher.full_name}!</p>
          </div>

          <button
            type="button"
            className="dispatcher-login-button"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </header>

        {error && (
          <p className="dispatcher-error" role="alert">
            {error}
          </p>
        )}



        <nav
          className="dispatcher-workspace-nav"
          aria-label="Dispatcher sections"
        >
          <button
            type="button"
            aria-pressed={workspace === "queue"}
            disabled={loading}
            onClick={() => setWorkspace("queue")}
          >
            Queue &amp; Dispatch
          </button>

          <button
            type="button"
            aria-pressed={workspace === "arrivals"}
            disabled={loading}
            onClick={() => setWorkspace("arrivals")}
          >
            Arrivals
          </button>
        </nav>

        {workspace === "queue" ? (
          <Jessie_QueueDispatch />
        ) : (
          <Jessie_TerminalMonitoring />
        )}
      </main>
    );
  }

  return (
    <main className="dispatcher-auth-page">
      <section
        className="dispatcher-auth-card"
        aria-labelledby="dispatcher-login-title"
      >
        <button
          type="button"
          className="dispatcher-back"
          onClick={onBack}
          disabled={loading}
        >
          Back to Home
        </button>

        <header className="dispatcher-auth-heading">
          <img
            src="/logo.png"
            alt="EasyRide"
            className="dispatcher-auth-logo"
          />
          <p className="dispatcher-eyebrow">
            TERMINAL OPERATIONS
          </p>
          <h1 id="dispatcher-login-title">
            Dispatcher Login
          </h1>
          <p>Access for authorized terminal dispatchers.</p>
        </header>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className="dispatcher-error" role="alert">
              {error}
            </p>
          )}

          <div className="dispatcher-field">
            <label htmlFor="dispatcher-username">
              Username
            </label>
            <input
              id="dispatcher-username"
              name="username"
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError("");
              }}
              autoComplete="username"
              maxLength={100}
              disabled={loading}
              required
            />
          </div>

          <div className="dispatcher-field">
            <label htmlFor="dispatcher-password">
              Password
            </label>
            <input
              id="dispatcher-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="dispatcher-login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
};

export default Jessie_DispatcherAuth;

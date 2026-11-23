# WBS 2.1.6 - Dispatcher Testing

Date: November 22, 2026

## Automated HTTP integration results

All 33 check groups passed against actual application routes using
an isolated test database and a temporary local HTTP server.

Coverage:
- Authentication, role restrictions, request headers, and logout.
- Missing, inside, outside, imprecise, and stale GPS readings.
- Request-time FIFO allocation and trip-state restrictions.
- Capacity and passenger-count validation.
- Empty, occupied, and full seat calculations.
- Repeated saves, stale revisions, and concurrent dispatcher updates.
- ETA validation, concurrent updates, and calculation timestamps.
- Philippine-time midnight crossing and outdated estimates.
- Completed-trip estimates and driver queue synchronization.
- Active-arrival release and retained daily allocation counters.

## Manual browser checks

The tester reported completing:
- Queue & Dispatch and Arrivals navigation.
- Trip Details and Seats/ETA switching.
- Close and Escape dismissal, with scrolling restored.
- Narrow browser-window layout and accessible buttons.
- Tab navigation and visible keyboard focus.

Screenshots show the dashboard, arrivals empty state, trip history,
trip-details dialog, and a narrowed desktop browser window.

## Run command

From the backend directory:

    node --env-file=.env scripts/testDispatcherIntegration.js

Each run creates a new isolated test database.
Test databases are retained for inspection.
The normal database and .env settings are not modified by the script.

## Limitations and follow-up

- The initial inside-GPS assertion failed once and passed on a later run.
  Its cause remains unconfirmed; diagnostic output is retained.
- A diagnostic SQL alias was corrected for MariaDB compatibility.
- GPS fixtures simulate coordinates and do not prove physical presence.
- Narrow-window testing does not replace testing on a physical phone.
- Passenger-view integration remains pending implementation.
- ETA uses dispatcher-entered travel duration, not live traffic.

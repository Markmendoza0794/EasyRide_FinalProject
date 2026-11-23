# WBS 3.1.2 - Van Information and Availability

Implemented by: Alexis Samonteza
Date: November 23, 2026

## Backend
- Added public, read-only GET /passenger/vans.
- Returns vehicle identification, destination, route, travel date,
  seat counts, and availability.
- Added dispatcher-protected boarding endpoints with request-header
  validation and revision checks.
- Boarding updates use the existing queue mutex.
- Starting boarding requires the first eligible FIFO trip,
  configured capacity, and an available seat.
- Departed and completed trips cannot change boarding settings.
- Public responses exclude driver contact and account information.

## Frontend
- Added Start/Stop Boarding for the first eligible waiting trip.
- Added At Terminal, On the Road, and Scheduled passenger tabs.
- Displays Waiting, Boarding, Full, Departed, Scheduled,
  and unavailable information states.
- Retains passenger seat counts and refresh controls.

## Verification
- Backend syntax and database setup checks passed.
- JSX syntax was checked during implementation.
- Screenshots showed dispatcher Boarding Open reflected as Boarding
  on the passenger page.
- Tester confirmed Stop Boarding returns the passenger status to Waiting.
- Tester confirmed full occupancy displays Full with zero available seats.
- Tester confirmed departure moves the van to On the Road as Departed.

## Remaining Verification
- Automated boarding access, validation, FIFO, and revision-conflict tests.
- Future-date Scheduled display and boarding rejection.
- Missing-capacity behavior and completed-trip removal.
- Automatic refresh, error recovery, keyboard, and narrow-window checks.
- Passenger ETA display and homepage terminal board remain pending.

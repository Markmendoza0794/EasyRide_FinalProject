# WBS 3.1.1 - Passenger Seat Availability

Implemented by: Alexis Samonteza
Date: November 22, 2026

## Backend
- Added public, read-only GET /passenger/seats.
- Reads capacity and passenger counts from dispatcher records.
- Calculates remaining seats without changing trip records.
- Lists active waiting trips scheduled for today or earlier.
- Excludes departed, completed, and future-date trips.
- Does not expose driver contact details or account information.
- Disables response caching.

## Frontend
- Adapted Alexis's existing passenger interface from commit a977a88.
- Connected the interface to the passenger API.
- Displays capacity, passenger count, available seats, and full status.
- Provides loading, empty, unavailable, and error states.
- Supports manual refresh and automatic refresh every 30 seconds
  while the page is visible.
- Added passenger navigation while preserving driver and dispatcher access.

## Verification
- Production build and formatting checks passed during implementation.
- Browser screenshot showed capacity 15, passenger count 8,
  and available seats 7.
- Tester confirmed full and empty passenger-count scenarios work.
- Empty-list state was observed before a waiting trip was allocated.

## Follow-up
- Verify automatic refresh, error recovery, and narrow-window layout.
- Add automated passenger endpoint integration tests.
- WBS 3.1.2 van information and availability remains separate.
- Passenger ETA display remains pending.

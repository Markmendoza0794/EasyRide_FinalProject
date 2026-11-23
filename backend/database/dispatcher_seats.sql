USE easyride_db;

CREATE TABLE IF NOT EXISTS dispatcher_trip_seats (
  queue_id INT NOT NULL,
  passenger_capacity SMALLINT UNSIGNED NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,

  PRIMARY KEY (queue_id),

  CONSTRAINT fk_trip_seats_queue
    FOREIGN KEY (queue_id)
    REFERENCES dispatcher_queue_entries (id),

  CONSTRAINT fk_trip_seats_dispatcher
    FOREIGN KEY (updated_by)
    REFERENCES dispatchers (id),

  CONSTRAINT chk_trip_passenger_capacity
    CHECK (passenger_capacity > 0)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS dispatcher_seat_assignments (
  queue_id INT NOT NULL,
  seat_number SMALLINT UNSIGNED NOT NULL,
  recorded_by INT NOT NULL,
  recorded_at DATETIME(3) NOT NULL,

  PRIMARY KEY (queue_id, seat_number),

  CONSTRAINT fk_seat_assignment_trip
    FOREIGN KEY (queue_id)
    REFERENCES dispatcher_trip_seats (queue_id),

  CONSTRAINT fk_seat_assignment_dispatcher
    FOREIGN KEY (recorded_by)
    REFERENCES dispatchers (id),

  CONSTRAINT chk_assignment_seat_number
    CHECK (seat_number > 0)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;
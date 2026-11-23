USE easyride_db;

CREATE TABLE IF NOT EXISTS dispatcher_trip_eta (
  queue_id INT NOT NULL,

  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  route_description VARCHAR(150) NOT NULL,

  estimated_duration_minutes SMALLINT UNSIGNED NOT NULL,

  revision INT UNSIGNED NOT NULL DEFAULT 1,

  updated_by INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,

  PRIMARY KEY (queue_id),

  CONSTRAINT fk_trip_eta_queue
    FOREIGN KEY (queue_id)
    REFERENCES dispatcher_queue_entries (id),

  CONSTRAINT fk_trip_eta_dispatcher
    FOREIGN KEY (updated_by)
    REFERENCES dispatchers (id),

  CONSTRAINT chk_trip_eta_duration
    CHECK (estimated_duration_minutes > 0)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;
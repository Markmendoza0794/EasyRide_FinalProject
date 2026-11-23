CREATE TABLE IF NOT EXISTS dispatcher_trip_boarding (
  queue_id INT NOT NULL,
  is_boarding TINYINT UNSIGNED NOT NULL DEFAULT 0,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,

  PRIMARY KEY (queue_id),

  CONSTRAINT fk_boarding_queue
    FOREIGN KEY (queue_id)
    REFERENCES dispatcher_queue_entries (id),

  CONSTRAINT fk_boarding_dispatcher
    FOREIGN KEY (updated_by)
    REFERENCES dispatchers (id),

  CONSTRAINT chk_boarding_flag
    CHECK (is_boarding IN (0, 1))
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;

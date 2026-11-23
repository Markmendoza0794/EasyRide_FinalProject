USE easyride_db;

CREATE TABLE IF NOT EXISTS driver_arrival_requests (
  id INT NOT NULL AUTO_INCREMENT,
  driver_id INT NOT NULL,

  status ENUM(
    'pending',
    'confirmed',
    'rejected',
    'cancelled',
    'completed'
  ) NOT NULL DEFAULT 'pending',

  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_meters DOUBLE NOT NULL,
  distance_meters DOUBLE NOT NULL,

  location_recorded_at DATETIME(3) NOT NULL,
  requested_at DATETIME(3) NOT NULL,
  confirmed_at DATETIME(3) DEFAULT NULL,
  resolved_at DATETIME(3) DEFAULT NULL,

  PRIMARY KEY (id),

  UNIQUE KEY uq_arrival_request_driver (
    id,
    driver_id
  ),

  KEY idx_arrival_driver_time (
    driver_id,
    requested_at
  ),

  KEY idx_arrival_status_time (
    status,
    requested_at
  ),

  CONSTRAINT fk_arrival_request_driver
    FOREIGN KEY (driver_id)
    REFERENCES drivers(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS driver_active_arrivals (
  driver_id INT NOT NULL,
  request_id INT NOT NULL,

  PRIMARY KEY (driver_id),
  UNIQUE KEY uq_active_arrival_request (request_id),

  CONSTRAINT fk_active_arrival_request
    FOREIGN KEY (
      request_id,
      driver_id
    )
    REFERENCES driver_arrival_requests (
      id,
      driver_id
    )
    ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;
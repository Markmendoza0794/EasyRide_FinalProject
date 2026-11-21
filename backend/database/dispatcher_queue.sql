USE easyride_db;

CREATE TABLE IF NOT EXISTS dispatcher_queue_mutex (
  id INT NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

INSERT IGNORE INTO dispatcher_queue_mutex (id)
VALUES (1);


CREATE TABLE IF NOT EXISTS dispatcher_queue_days (
  travel_date DATE NOT NULL PRIMARY KEY,
  allocated_count INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS dispatcher_queue_entries (
  id INT NOT NULL AUTO_INCREMENT,
  request_id INT NOT NULL,
  driver_id INT NOT NULL,

  travel_date DATE NOT NULL,
  queue_number INT NOT NULL,

  status ENUM(
    'waiting',
    'departed',
    'completed'
  ) NOT NULL DEFAULT 'waiting',

  allocated_by INT NOT NULL,
  allocated_at DATETIME(3) NOT NULL,

  departed_by INT DEFAULT NULL,
  departed_at DATETIME(3) DEFAULT NULL,

  completed_by INT DEFAULT NULL,
  completed_at DATETIME(3) DEFAULT NULL,

  PRIMARY KEY (id),

  UNIQUE KEY uq_queue_request (request_id),

  UNIQUE KEY uq_queue_day_number (
    travel_date,
    queue_number
  ),

  UNIQUE KEY uq_queue_id_driver (
    id,
    driver_id
  ),

  KEY idx_queue_status_date (
    status,
    travel_date,
    queue_number
  ),

  CONSTRAINT fk_queue_arrival
    FOREIGN KEY (request_id, driver_id)
    REFERENCES driver_arrival_requests (id, driver_id),

  CONSTRAINT fk_queue_day
    FOREIGN KEY (travel_date)
    REFERENCES dispatcher_queue_days (travel_date),

  CONSTRAINT fk_queue_allocator
    FOREIGN KEY (allocated_by)
    REFERENCES dispatchers(id),

  CONSTRAINT fk_queue_departure_dispatcher
    FOREIGN KEY (departed_by)
    REFERENCES dispatchers(id),

  CONSTRAINT fk_queue_completion_dispatcher
    FOREIGN KEY (completed_by)
    REFERENCES dispatchers(id)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS driver_active_queues (
  driver_id INT NOT NULL PRIMARY KEY,
  queue_id INT NOT NULL,

  UNIQUE KEY uq_active_queue_entry (queue_id),

  CONSTRAINT fk_active_queue_driver
    FOREIGN KEY (queue_id, driver_id)
    REFERENCES dispatcher_queue_entries (id, driver_id)
) ENGINE=InnoDB;
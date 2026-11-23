USE easyride_db;

ALTER TABLE driver_arrival_requests
  ADD COLUMN reviewed_by INT DEFAULT NULL,
  ADD COLUMN reviewed_at DATETIME(3) DEFAULT NULL,
  ADD COLUMN review_note VARCHAR(255) DEFAULT NULL,
  ADD CONSTRAINT fk_arrival_reviewer
    FOREIGN KEY (reviewed_by)
    REFERENCES dispatchers(id);
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  location VARCHAR(120) NOT NULL,
  event_date DATETIME NOT NULL,
  capacity INT NOT NULL DEFAULT 100,
  image_url VARCHAR(500) NULL
);
CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_email (event_id, email),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO events (title, location, event_date, capacity) VALUES
 ('Intro to Docker', 'Room A', '2026-11-10 09:00:00', 100),
 ('CI/CD with Jenkins', 'Room B', '2026-11-17 13:00:00', 100),
 ('React Workshop', 'Main Hall', '2026-11-24 10:00:00', 100);

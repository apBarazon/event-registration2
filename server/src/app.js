const express = require('express');
const { makeToken, readToken, hashPassword, checkPassword } = require('./auth');

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Admin account is hardcoded (override with env vars if you want)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@events.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// name + email validation shared by register / edit registration
function readPerson(body) {
  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase();
  const error = !name ? 'Name is required' : !EMAIL_RE.test(email) ? 'Enter a valid email' : null;
  return { name, email, error };
}

// event fields validation shared by admin create / update
function readEvent(body) {
  const ev = {
    title: String(body?.title ?? '').trim(),
    location: String(body?.location ?? '').trim(),
    event_date: String(body?.event_date ?? '').trim(),
    capacity: Number(body?.capacity),
    image_url: String(body?.image_url ?? '').trim() || null,
  };
  let error = null;
  if (!ev.title || !ev.location) error = 'Title and location are required';
  else if (!ev.event_date || Number.isNaN(Date.parse(ev.event_date))) error = 'Enter a valid date';
  else if (!Number.isInteger(ev.capacity) || ev.capacity < 1) error = 'Capacity must be at least 1';
  else if (ev.image_url && !/^https?:\/\//i.test(ev.image_url)) error = 'Image must be an http(s) URL';
  // MySQL DATETIME format: 'YYYY-MM-DD HH:MM:SS'
  ev.event_date = ev.event_date.replace('T', ' ');
  if (ev.event_date.length === 16) ev.event_date += ':00';
  return { ev, error };
}

const validId = (v) => Number.isInteger(Number(v)) && Number(v) >= 1;

// `db` is injected (mysql2 pool in prod, a fake in unit tests)
function createApp(db) {
  const app = express();
  app.use(express.json());

  // Every request: read the login token (if any) into req.user
  app.use((req, res, next) => {
    req.user = readToken((req.headers.authorization || '').replace('Bearer ', ''));
    next();
  });
  const needUser = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: 'Please log in' });
  const needAdmin = (req, res, next) =>
    !req.user ? res.status(401).json({ error: 'Please log in' })
      : req.user.role !== 'admin' ? res.status(403).json({ error: 'Admin only' })
        : next();

  // Health: 200 only if the DB answers
  app.get('/api/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'down' });
    }
  });

  // ---------- accounts ----------
  app.post('/api/auth/signup', async (req, res, next) => {
    const { name, email, error } = readPerson(req.body);
    const password = String(req.body?.password ?? '');
    if (error) return res.status(400).json({ error });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (email === ADMIN_EMAIL) return res.status(409).json({ error: 'Email already in use' });

    try {
      const [result] = await db.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashPassword(password)]
      );
      const user = { id: result.insertId, name, email, role: 'user' };
      res.status(201).json({ token: makeToken(user), user });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use' });
      next(err);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const admin = { id: 0, name: 'Admin', email, role: 'admin' };
      return res.json({ token: makeToken(admin), user: admin });
    }
    try {
      const [rows] = await db.query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
      if (rows.length === 0 || !checkPassword(password, rows[0].password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: 'user' };
      res.json({ token: makeToken(user), user });
    } catch (err) { next(err); }
  });

  // ---------- events (public) ----------
  app.get('/api/events', async (req, res, next) => {
    try {
      const [rows] = await db.query(
        `SELECT e.id, e.title, e.location, e.event_date, e.capacity, e.image_url,
                (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registered
         FROM events e ORDER BY e.event_date`
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  // Works logged out (as before) or logged in (then it shows up in "My Registrations")
  app.post('/api/events/:id/register', async (req, res, next) => {
    const id = Number(req.params.id);
    const { name, email, error } = readPerson(req.body);

    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid event id' });
    if (error) return res.status(400).json({ error });
    const userId = req.user?.role === 'user' ? req.user.id : null;

    try {
      const [rows] = await db.query(
        `SELECT e.capacity,
                (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registered
         FROM events e WHERE e.id = ?`, [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
      if (rows[0].registered >= rows[0].capacity) return res.status(409).json({ error: 'Event is full' });

      await db.query('INSERT INTO registrations (event_id, user_id, name, email) VALUES (?, ?, ?, ?)', [id, userId, name, email]);
      res.status(201).json({ message: 'Registered' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already registered' });
      next(err);
    }
  });

  // ---------- my registrations (logged in) ----------
  app.get('/api/me/registrations', needUser, async (req, res, next) => {
    try {
      const [rows] = await db.query(
        `SELECT r.id, r.name, r.email, e.title, e.location, e.event_date
         FROM registrations r JOIN events e ON e.id = r.event_id
         WHERE r.user_id = ? ORDER BY e.event_date`, [req.user.id]
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  app.put('/api/me/registrations/:id', needUser, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid registration id' });
    const { name, email, error } = readPerson(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const [result] = await db.query(
        'UPDATE registrations SET name = ?, email = ? WHERE id = ? AND user_id = ?',
        [name, email, Number(req.params.id), req.user.id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Registration not found' });
      res.json({ message: 'Updated' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already registered' });
      next(err);
    }
  });

  app.delete('/api/me/registrations/:id', needUser, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid registration id' });
    try {
      const [result] = await db.query('DELETE FROM registrations WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Registration not found' });
      res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
  });

  // ---------- admin ----------
  app.post('/api/admin/events', needAdmin, async (req, res, next) => {
    const { ev, error } = readEvent(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const [result] = await db.query(
        'INSERT INTO events (title, location, event_date, capacity, image_url) VALUES (?, ?, ?, ?, ?)',
        [ev.title, ev.location, ev.event_date, ev.capacity, ev.image_url]
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) { next(err); }
  });

  app.put('/api/admin/events/:id', needAdmin, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid event id' });
    const { ev, error } = readEvent(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const [result] = await db.query(
        'UPDATE events SET title = ?, location = ?, event_date = ?, capacity = ?, image_url = ? WHERE id = ?',
        [ev.title, ev.location, ev.event_date, ev.capacity, ev.image_url, Number(req.params.id)]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Event not found' });
      res.json({ message: 'Updated' });
    } catch (err) { next(err); }
  });

  app.delete('/api/admin/events/:id', needAdmin, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid event id' });
    try {
      const [result] = await db.query('DELETE FROM events WHERE id = ?', [Number(req.params.id)]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Event not found' });
      res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/events/:id/registrations', needAdmin, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid event id' });
    try {
      const [rows] = await db.query(
        'SELECT id, name, email, created_at FROM registrations WHERE event_id = ? ORDER BY created_at',
        [Number(req.params.id)]
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  // Report table: one row per event
  app.get('/api/admin/report', needAdmin, async (req, res, next) => {
    try {
      const [rows] = await db.query(
        `SELECT e.id, e.title, e.event_date, e.capacity, COUNT(r.id) AS registered
         FROM events e LEFT JOIN registrations r ON r.event_id = e.id
         GROUP BY e.id ORDER BY e.event_date`
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

module.exports = { createApp };

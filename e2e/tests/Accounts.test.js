// End-to-end tests for accounts, My Registrations and the admin panel.
// Same style as Smoke.test.js: real HTTP against nginx -> Express -> MySQL.
const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const call = (method, path, body, token) =>
  fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@events.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const stamp = Date.now();
const email = `acc${stamp}@example.com`;
let token, adminToken;

test('user can sign up and log in', async () => {
  const signup = await call('POST', '/api/auth/signup', { name: 'Acc User', email, password: 'secret1' });
  expect(signup.status).toBe(201);
  expect((await signup.json()).token).toBeTruthy();

  const login = await call('POST', '/api/auth/login', { email, password: 'secret1' });
  expect(login.status).toBe(200);
  token = (await login.json()).token;
});

test('wrong password and duplicate signup are rejected', async () => {
  expect((await call('POST', '/api/auth/login', { email, password: 'nope-nope' })).status).toBe(401);
  expect((await call('POST', '/api/auth/signup', { name: 'Again', email, password: 'secret1' })).status).toBe(409);
});

test('My Registrations needs a login', async () => {
  expect((await call('GET', '/api/me/registrations')).status).toBe(401);
});

test('logged-in registration appears in My Registrations, can be edited and deleted', async () => {
  const reg = await call('POST', '/api/events/3/register', { name: 'Acc User', email }, token);
  expect(reg.status).toBe(201);

  let list = await (await call('GET', '/api/me/registrations', null, token)).json();
  expect(list).toHaveLength(1);
  expect(list[0].title).toBe('React Workshop');

  const edit = await call('PUT', `/api/me/registrations/${list[0].id}`, { name: 'Renamed', email }, token);
  expect(edit.status).toBe(200);
  list = await (await call('GET', '/api/me/registrations', null, token)).json();
  expect(list[0].name).toBe('Renamed');

  expect((await call('DELETE', `/api/me/registrations/${list[0].id}`, null, token)).status).toBe(200);
  list = await (await call('GET', '/api/me/registrations', null, token)).json();
  expect(list).toHaveLength(0);
});

test('admin can log in, normal users cannot use admin routes', async () => {
  const res = await call('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  expect(res.status).toBe(200);
  adminToken = (await res.json()).token;

  expect((await call('GET', '/api/admin/report')).status).toBe(401);
  expect((await call('GET', '/api/admin/report', null, token)).status).toBe(403);
});

test('admin can create, edit, see registrants of, and delete an event', async () => {
  const ev = { title: `E2E ${stamp}`, location: 'Lab', event_date: '2026-12-01T10:00', capacity: 5, image_url: 'https://example.com/pic.jpg' };
  const created = await call('POST', '/api/admin/events', ev, adminToken);
  expect(created.status).toBe(201);
  const { id } = await created.json();

  const listed = await (await fetch(`${BASE_URL}/api/events`)).json();
  expect(listed.find((e) => e.id === id).image_url).toBe('https://example.com/pic.jpg');

  expect((await call('PUT', `/api/admin/events/${id}`, { ...ev, capacity: 8 }, adminToken)).status).toBe(200);

  expect((await call('POST', `/api/events/${id}/register`, { name: 'Guest', email: `guest${stamp}@example.com` })).status).toBe(201);
  const people = await (await call('GET', `/api/admin/events/${id}/registrations`, null, adminToken)).json();
  expect(people.map((p) => p.name)).toContain('Guest');

  const report = await (await call('GET', '/api/admin/report', null, adminToken)).json();
  expect(report.find((r) => r.id === id)).toMatchObject({ capacity: 8, registered: 1 });

  expect((await call('DELETE', `/api/admin/events/${id}`, null, adminToken)).status).toBe(200);
  expect((await call('DELETE', `/api/admin/events/${id}`, null, adminToken)).status).toBe(404);
});

test('event validation rejects a non-http image url', async () => {
  const res = await call('POST', '/api/admin/events', { title: 'x', location: 'y', event_date: '2026-12-01T10:00', capacity: 5, image_url: 'ftp://nope' }, adminToken);
  expect(res.status).toBe(400);
});

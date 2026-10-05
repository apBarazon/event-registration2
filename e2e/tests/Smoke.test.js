// End-to-end smoke tests: talks to the real test stack over HTTP
// (nginx -> Express -> MySQL). No browser needed. Node 20 has global fetch.
const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const post = (path, body) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('home page is served by nginx', async () => {
  const res = await fetch(`${BASE_URL}/`);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('<div id="root">');
});

test('deep links and unknown routes fall back to the SPA (nginx try_files)', async () => {
  for (const path of ['/events/3', '/nope']) {
    const res = await fetch(`${BASE_URL}${path}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div id="root">');
  }
});

test('API lists the seeded events (nginx -> Express -> MySQL)', async () => {
  const res = await fetch(`${BASE_URL}/api/events`);
  expect(res.status).toBe(200);
  const events = await res.json();
  expect(events.length).toBeGreaterThanOrEqual(3);
  expect(events.map((e) => e.title)).toContain('CI/CD with Jenkins');
});

test('user can register for an event', async () => {
  const res = await post('/api/events/1/register', { name: 'Test User', email: `user${Date.now()}@example.com` });
  expect(res.status).toBe(201);
  expect((await res.json()).message).toBe('Registered');
});

test('duplicate registration is rejected', async () => {
  const email = `dup${Date.now()}@example.com`;
  expect((await post('/api/events/2/register', { name: 'Dup User', email })).status).toBe(201);

  const res = await post('/api/events/2/register', { name: 'Dup User', email });
  expect(res.status).toBe(409);
  expect((await res.json()).error).toContain('already registered');
});

test('invalid email is rejected with a validation message', async () => {
  const res = await post('/api/events/1/register', { name: 'Test', email: 'not-an-email' });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain('valid email');
});

test('registering for a non-existent event returns 404', async () => {
  const res = await post('/api/events/9999/register', { name: 'Test', email: `x${Date.now()}@example.com` });
  expect(res.status).toBe(404);
});
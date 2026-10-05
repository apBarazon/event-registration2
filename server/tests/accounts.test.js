const request = require('supertest');
const { createApp } = require('../src/app');
const { makeToken, hashPassword } = require('../src/auth');

let db, app;
beforeEach(() => {
  db = { query: jest.fn() };
  app = createApp(db);
});

const userToken = makeToken({ id: 5, name: 'Ana', email: 'ana@example.com', role: 'user' });
const adminToken = makeToken({ id: 0, name: 'Admin', email: 'admin@events.local', role: 'admin' });
const as = (token) => ({ Authorization: `Bearer ${token}` });

describe('POST /api/auth/signup', () => {
  const body = { name: 'Ana', email: 'ana@example.com', password: 'secret1' };

  test('400 on short password', async () => {
    const res = await request(app).post('/api/auth/signup').send({ ...body, password: '123' });
    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
  test('201 returns a token and never stores the plain password', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 5 }]);
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('user');
    expect(db.query.mock.calls[0][1]).not.toContain('secret1');
  });
  test('409 when email is taken', async () => {
    db.query.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('hardcoded admin can log in without touching the DB', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@events.local', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect(db.query).not.toHaveBeenCalled();
  });
  test('200 for a valid user', async () => {
    db.query.mockResolvedValueOnce([[{ id: 5, name: 'Ana', email: 'ana@example.com', password_hash: hashPassword('secret1') }]]);
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@example.com', password: 'secret1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
  test('401 on wrong password', async () => {
    db.query.mockResolvedValueOnce([[{ id: 5, name: 'Ana', email: 'ana@example.com', password_hash: hashPassword('secret1') }]]);
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
  test('401 for an unknown email', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'secret1' });
    expect(res.status).toBe(401);
  });
});

describe('registering while logged in', () => {
  test('saves the user id on the registration', async () => {
    db.query.mockResolvedValueOnce([[{ capacity: 2, registered: 0 }]]).mockResolvedValueOnce([{ insertId: 9 }]);
    const res = await request(app).post('/api/events/1/register').set(as(userToken)).send({ name: 'Ana', email: 'ana@example.com' });
    expect(res.status).toBe(201);
    expect(db.query.mock.calls[1][1]).toEqual([1, 5, 'Ana', 'ana@example.com']);
  });
});

describe('/api/me/registrations', () => {
  test('401 when logged out', async () => {
    const res = await request(app).get('/api/me/registrations');
    expect(res.status).toBe(401);
  });
  test('lists only my registrations', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, title: 'Intro' }]]);
    const res = await request(app).get('/api/me/registrations').set(as(userToken));
    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });
  test('edit: 400 on invalid email', async () => {
    const res = await request(app).put('/api/me/registrations/1').set(as(userToken)).send({ name: 'Ana', email: 'nope' });
    expect(res.status).toBe(400);
  });
  test('edit: 200 on success', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).put('/api/me/registrations/1').set(as(userToken)).send({ name: 'Ana B', email: 'ana@example.com' });
    expect(res.status).toBe(200);
  });
  test('edit: 404 when it belongs to someone else', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await request(app).put('/api/me/registrations/1').set(as(userToken)).send({ name: 'Ana', email: 'ana@example.com' });
    expect(res.status).toBe(404);
  });
  test('delete: 200 then 404', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect((await request(app).delete('/api/me/registrations/1').set(as(userToken))).status).toBe(200);
    expect((await request(app).delete('/api/me/registrations/1').set(as(userToken))).status).toBe(404);
  });
});

describe('admin', () => {
  const ev = { title: 'Talk', location: 'Room C', event_date: '2026-12-01T10:00', capacity: 30, image_url: 'https://example.com/a.jpg' };

  test('401 without a token, 403 for a normal user', async () => {
    expect((await request(app).get('/api/admin/report')).status).toBe(401);
    expect((await request(app).get('/api/admin/report').set(as(userToken))).status).toBe(403);
  });
  test('a forged token is rejected', async () => {
    const res = await request(app).get('/api/admin/report').set(as(`${adminToken}x`));
    expect(res.status).toBe(401);
  });
  test('report returns one row per event', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, title: 'Intro', capacity: 10, registered: 4 }]]);
    const res = await request(app).get('/api/admin/report').set(as(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].registered).toBe(4);
  });
  test('create event: 400 on bad image url, 201 on success', async () => {
    expect((await request(app).post('/api/admin/events').set(as(adminToken)).send({ ...ev, image_url: 'javascript:x' })).status).toBe(400);
    db.query.mockResolvedValueOnce([{ insertId: 8 }]);
    const res = await request(app).post('/api/admin/events').set(as(adminToken)).send(ev);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(8);
  });
  test('update event: 200, and 404 when missing', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect((await request(app).put('/api/admin/events/8').set(as(adminToken)).send(ev)).status).toBe(200);
    expect((await request(app).put('/api/admin/events/99').set(as(adminToken)).send(ev)).status).toBe(404);
  });
  test('delete event', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect((await request(app).delete('/api/admin/events/8').set(as(adminToken))).status).toBe(200);
  });
  test('admin can see who registered', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, name: 'Ana', email: 'ana@example.com' }]]);
    const res = await request(app).get('/api/admin/events/1/registrations').set(as(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Ana');
  });
});

const request = require('supertest');
const { createApp } = require('../src/app');

let db, app;
beforeEach(() => {
  db = { query: jest.fn() };
  app = createApp(db);
});

describe('GET /api/health', () => {
  test('200 when DB responds', async () => {
    db.query.mockResolvedValueOnce([[{ 1: 1 }]]);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
  test('503 when DB is down', async () => {
    db.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
  });
});

describe('GET /api/events', () => {
  test('returns the event list', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, title: 'Intro', registered: 0, capacity: 10 }]]);
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Intro');
  });
});

describe('POST /api/events/:id/register', () => {
  const body = { name: 'Ana', email: 'ana@example.com' };

  test('400 on invalid email', async () => {
    const res = await request(app).post('/api/events/1/register').send({ name: 'Ana', email: 'nope' });
    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
  test('400 on missing name', async () => {
    const res = await request(app).post('/api/events/1/register').send({ email: 'a@b.co' });
    expect(res.status).toBe(400);
  });
  test('404 when event does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).post('/api/events/99/register').send(body);
    expect(res.status).toBe(404);
  });
  test('409 when event is full', async () => {
    db.query.mockResolvedValueOnce([[{ capacity: 2, registered: 2 }]]);
    const res = await request(app).post('/api/events/1/register').send(body);
    expect(res.status).toBe(409);
  });
  test('201 on success', async () => {
    db.query.mockResolvedValueOnce([[{ capacity: 2, registered: 0 }]]).mockResolvedValueOnce([{ insertId: 5 }]);
    const res = await request(app).post('/api/events/1/register').send(body);
    expect(res.status).toBe(201);
  });
  test('409 on duplicate email', async () => {
    db.query.mockResolvedValueOnce([[{ capacity: 2, registered: 0 }]])
            .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    const res = await request(app).post('/api/events/1/register').send(body);
    expect(res.status).toBe(409);
  });
});
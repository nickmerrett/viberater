import request from 'supertest';
import app from './testApp.js';
import { query } from '../src/config/database.js';

async function cleanDb() {
  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM ideas');
  await query('DELETE FROM devices');
  await query('DELETE FROM users');
}

beforeEach(cleanDb);
afterAll(cleanDb);

describe('POST /api/auth/register', () => {
  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('registers a new user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123', name: 'Test User' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.name).toBe('Test User');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('returns 409 for a duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', password: 'password123' });
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('returns tokens on successful login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@example.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user data with a valid token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'me@example.com', password: 'password123' });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });
});

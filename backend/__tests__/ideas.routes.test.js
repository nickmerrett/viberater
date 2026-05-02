import request from 'supertest';
import app from './testApp.js';
import { query } from '../src/config/database.js';

let token;
let userId;

async function cleanDb() {
  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM ideas');
  await query('DELETE FROM devices');
  await query('DELETE FROM users');
}

beforeAll(async () => {
  await cleanDb();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'ideas@example.com', password: 'password123' });
  token = res.body.accessToken;
  userId = res.body.user.id;
});

afterAll(cleanDb);

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GET /api/ideas', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/ideas');
    expect(res.status).toBe(401);
  });

  it('returns an empty list for a new user', async () => {
    const res = await request(app).get('/api/ideas').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.ideas).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe('POST /api/ideas', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/ideas').set(auth()).send({ summary: 'no title' });
    expect(res.status).toBe(400);
  });

  it('creates an idea and returns it', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .set(auth())
      .send({ title: 'My Idea', summary: 'A great idea', tags: ['ai', 'web'] });
    expect(res.status).toBe(201);
    expect(res.body.idea.title).toBe('My Idea');
    expect(res.body.idea.user_id).toBe(userId);
  });
});

describe('idea CRUD', () => {
  let ideaId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/ideas')
      .set(auth())
      .send({ title: 'CRUD Test Idea', summary: 'For testing' });
    ideaId = res.body.idea.id;
  });

  it('gets a single idea by id', async () => {
    const res = await request(app).get(`/api/ideas/${ideaId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.idea.id).toBe(ideaId);
  });

  it('updates an idea', async () => {
    const res = await request(app)
      .put(`/api/ideas/${ideaId}`)
      .set(auth())
      .send({ title: 'Updated Title', status: 'refined' });
    expect(res.status).toBe(200);
    expect(res.body.idea.title).toBe('Updated Title');
    expect(res.body.idea.status).toBe('refined');
  });

  it('returns 404 for another user trying to access the idea', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@example.com', password: 'password123' });
    const res = await request(app)
      .get(`/api/ideas/${ideaId}`)
      .set({ Authorization: `Bearer ${other.body.accessToken}` });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent idea', async () => {
    const res = await request(app)
      .get('/api/ideas/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });

  it('deletes the idea', async () => {
    const res = await request(app).delete(`/api/ideas/${ideaId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 after deletion', async () => {
    const res = await request(app).get(`/api/ideas/${ideaId}`).set(auth());
    expect(res.status).toBe(404);
  });
});

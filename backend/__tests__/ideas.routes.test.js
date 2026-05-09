import request from 'supertest';
import app from './testApp.js';
import { query } from '../src/config/database.js';

let token;
let userId;

async function cleanDb() {
  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM idea_comments');
  await query('DELETE FROM idea_reactions');
  await query('DELETE FROM ideas');
  await query('DELETE FROM areas');
  await query('DELETE FROM devices');
  await query('DELETE FROM users');
}

// Register a fresh user before each test — prevents state leaking between tests
beforeEach(async () => {
  await cleanDb();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'ideas@example.com', password: 'password123' });
  token = res.body.accessToken;
  userId = res.body.user.id;
});

afterAll(cleanDb);

const auth = () => ({ Authorization: `Bearer ${token}` });

// Helper — create an idea and return it
async function createIdea(data = {}) {
  const res = await request(app)
    .post('/api/ideas')
    .set(auth())
    .send({ title: 'Test Idea', ...data });
  return res.body.idea;
}

// ── Auth guard ─────────────────────────────────────────────────────────────

describe('auth guard', () => {
  it('GET /api/ideas returns 401 without token', async () => {
    const res = await request(app).get('/api/ideas');
    expect(res.status).toBe(401);
  });

  it('POST /api/ideas returns 401 without token', async () => {
    const res = await request(app).post('/api/ideas').send({ title: 'x' });
    expect(res.status).toBe(401);
  });
});

// ── List ───────────────────────────────────────────────────────────────────

describe('GET /api/ideas', () => {
  it('returns empty list for a new user', async () => {
    const res = await request(app).get('/api/ideas').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.ideas).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns created ideas', async () => {
    await createIdea({ title: 'Idea A' });
    await createIdea({ title: 'Idea B' });
    const res = await request(app).get('/api/ideas').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.ideas).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('filters by status', async () => {
    await createIdea({ title: 'Active' });
    const idea = await createIdea({ title: 'To refine' });
    await request(app).put(`/api/ideas/${idea.id}`).set(auth()).send({ status: 'refined' });

    const res = await request(app).get('/api/ideas?status=refined').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.ideas).toHaveLength(1);
    expect(res.body.ideas[0].title).toBe('To refine');
  });

  it('respects limit and offset', async () => {
    await createIdea({ title: 'A' });
    await createIdea({ title: 'B' });
    await createIdea({ title: 'C' });

    const res = await request(app).get('/api/ideas?limit=2&offset=0').set(auth());
    expect(res.body.ideas).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });
});

// ── Create ─────────────────────────────────────────────────────────────────

describe('POST /api/ideas', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .set(auth())
      .send({ summary: 'no title' });
    expect(res.status).toBe(400);
  });

  it('creates an idea with minimal fields', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .set(auth())
      .send({ title: 'My Idea' });
    expect(res.status).toBe(201);
    expect(res.body.idea.title).toBe('My Idea');
    expect(res.body.idea.user_id).toBe(userId);
  });

  it('creates an idea with tags and vibe', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .set(auth())
      .send({ title: 'Tagged', tags: ['ai', 'web'], vibe: ['creative'] });
    expect(res.status).toBe(201);
    expect(res.body.idea.tags).toEqual(['ai', 'web']);
    expect(res.body.idea.vibe).toEqual(['creative']);
  });

  it('creates an idea with area_id', async () => {
    const areaRes = await request(app)
      .post('/api/areas')
      .set(auth())
      .send({ name: 'Work', color: '#ff0000' });
    const areaId = areaRes.body.area.id;

    const res = await request(app)
      .post('/api/ideas')
      .set(auth())
      .send({ title: 'Work idea', area_id: areaId });
    expect(res.status).toBe(201);
    expect(res.body.idea.area_id).toBe(areaId);
  });
});

// ── Read ───────────────────────────────────────────────────────────────────

describe('GET /api/ideas/:id', () => {
  it('returns the idea', async () => {
    const idea = await createIdea();
    const res = await request(app).get(`/api/ideas/${idea.id}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.idea.id).toBe(idea.id);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await request(app)
      .get('/api/ideas/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });

  it('returns 404 when another user tries to access the idea', async () => {
    const idea = await createIdea();
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@example.com', password: 'password123' });
    const res = await request(app)
      .get(`/api/ideas/${idea.id}`)
      .set({ Authorization: `Bearer ${other.body.accessToken}` });
    expect(res.status).toBe(404);
  });
});

// ── Update ─────────────────────────────────────────────────────────────────

describe('PUT /api/ideas/:id', () => {
  it('updates title and status', async () => {
    const idea = await createIdea();
    const res = await request(app)
      .put(`/api/ideas/${idea.id}`)
      .set(auth())
      .send({ title: 'Updated', status: 'refined' });
    expect(res.status).toBe(200);
    expect(res.body.idea.title).toBe('Updated');
    expect(res.body.idea.status).toBe('refined');
  });

  it('updates tags', async () => {
    const idea = await createIdea();
    const res = await request(app)
      .put(`/api/ideas/${idea.id}`)
      .set(auth())
      .send({ tags: ['updated', 'tags'] });
    expect(res.status).toBe(200);
    expect(res.body.idea.tags).toEqual(['updated', 'tags']);
  });

  it('archives an idea', async () => {
    const idea = await createIdea();
    const res = await request(app)
      .put(`/api/ideas/${idea.id}`)
      .set(auth())
      .send({ archived: true });
    expect(res.status).toBe(200);
    expect(res.body.idea.archived).toBe(true);
  });

  it('returns 404 for another user', async () => {
    const idea = await createIdea();
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other2@example.com', password: 'password123' });
    const res = await request(app)
      .put(`/api/ideas/${idea.id}`)
      .set({ Authorization: `Bearer ${other.body.accessToken}` })
      .send({ title: 'Stolen' });
    expect(res.status).toBe(404);
  });
});

// ── Delete ─────────────────────────────────────────────────────────────────

describe('DELETE /api/ideas/:id', () => {
  it('deletes the idea', async () => {
    const idea = await createIdea();
    const res = await request(app).delete(`/api/ideas/${idea.id}`).set(auth());
    expect(res.status).toBe(200);
  });

  it('returns 404 after deletion', async () => {
    const idea = await createIdea();
    await request(app).delete(`/api/ideas/${idea.id}`).set(auth());
    const res = await request(app).get(`/api/ideas/${idea.id}`).set(auth());
    expect(res.status).toBe(404);
  });

  it('returns 404 when another user tries to delete', async () => {
    const idea = await createIdea();
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other3@example.com', password: 'password123' });
    const res = await request(app)
      .delete(`/api/ideas/${idea.id}`)
      .set({ Authorization: `Bearer ${other.body.accessToken}` });
    expect(res.status).toBe(404);
  });
});

// ── Sharing ────────────────────────────────────────────────────────────────

describe('idea sharing', () => {
  it('enables sharing and returns a share token', async () => {
    const idea = await createIdea();
    const res = await request(app)
      .patch(`/api/share/manage/${idea.id}`)
      .set(auth())
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.sharing_enabled).toBe(true);
    expect(res.body.share_token).toBeDefined();
  });

  it('shared idea is publicly accessible', async () => {
    const idea = await createIdea({ title: 'Public Idea' });
    const share = await request(app)
      .patch(`/api/share/manage/${idea.id}`)
      .set(auth())
      .send({ enabled: true });
    const token = share.body.share_token;

    const res = await request(app).get(`/api/share/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.idea.title).toBe('Public Idea');
  });

  it('disabling sharing makes the link 404', async () => {
    const idea = await createIdea();
    const share = await request(app)
      .patch(`/api/share/manage/${idea.id}`)
      .set(auth())
      .send({ enabled: true });
    const shareToken = share.body.share_token;

    await request(app)
      .patch(`/api/share/manage/${idea.id}`)
      .set(auth())
      .send({ enabled: false });

    const res = await request(app).get(`/api/share/${shareToken}`);
    expect(res.status).toBe(404);
  });
});

import express from 'express';
import { db, generateUUID } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

export const DEFAULT_AREAS = [
  { name: 'Work',     color: '#3b82f6', sort_order: 0 },
  { name: 'Home',     color: '#22c55e', sort_order: 1 },
  { name: 'Personal', color: '#a855f7', sort_order: 2 },
  { name: 'Blog',     color: '#f97316', sort_order: 3 },
];

export async function bootstrapAreas(userId) {
  await db('areas').insert(
    DEFAULT_AREAS.map(a => ({ id: generateUUID(), user_id: userId, ...a }))
  );
}

router.get('/', async (req, res) => {
  try {
    const areas = await db('areas')
      .where({ user_id: req.user.userId })
      .orderBy([{ column: 'sort_order' }, { column: 'created_at' }]);
    res.json({ areas });
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, color = '#6366f1' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const [{ count }] = await db('areas').where({ user_id: req.user.userId }).count('* as count');

    const [area] = await db('areas').insert({
      id: generateUUID(),
      user_id: req.user.userId,
      name: name.trim(),
      color,
      sort_order: parseInt(count),
    }).returning('*');

    res.status(201).json({ area });
  } catch (error) {
    console.error('Create area error:', error);
    res.status(500).json({ error: 'Failed to create area' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    const updates = {};
    if (name  !== undefined) updates.name       = name.trim();
    if (color !== undefined) updates.color      = color;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const [area] = await db('areas')
      .where({ id: req.params.id, user_id: req.user.userId })
      .update(updates)
      .returning('*');

    if (!area) return res.status(404).json({ error: 'Area not found' });
    res.json({ area });
  } catch (error) {
    console.error('Update area error:', error);
    res.status(500).json({ error: 'Failed to update area' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await db('areas').where({ id: req.params.id, user_id: req.user.userId }).del();
    if (!deleted) return res.status(404).json({ error: 'Area not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete area error:', error);
    res.status(500).json({ error: 'Failed to delete area' });
  }
});

export default router;

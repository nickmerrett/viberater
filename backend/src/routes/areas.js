import express from 'express';
import { query } from '../config/database.js';
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
  for (const area of DEFAULT_AREAS) {
    await query(
      `INSERT INTO areas (user_id, name, color, sort_order) VALUES ($1, $2, $3, $4)`,
      [userId, area.name, area.color, area.sort_order]
    );
  }
}

// List areas
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM areas WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [req.user.userId]
    );
    res.json({ areas: result.rows });
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

// Create area
router.post('/', async (req, res) => {
  try {
    const { name, color = '#6366f1' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const count = await query(`SELECT COUNT(*) FROM areas WHERE user_id = $1`, [req.user.userId]);
    const sort_order = parseInt(count.rows[0].count);

    const result = await query(
      `INSERT INTO areas (user_id, name, color, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.userId, name.trim(), color, sort_order]
    );
    res.status(201).json({ area: result.rows[0] });
  } catch (error) {
    console.error('Create area error:', error);
    res.status(500).json({ error: 'Failed to create area' });
  }
});

// Update area
router.put('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    const result = await query(
      `UPDATE areas SET
        name = COALESCE($1, name),
        color = COALESCE($2, color)
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [name, color, req.params.id, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Area not found' });
    res.json({ area: result.rows[0] });
  } catch (error) {
    console.error('Update area error:', error);
    res.status(500).json({ error: 'Failed to update area' });
  }
});

// Delete area (nullifies area_id on content)
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM areas WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Area not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete area error:', error);
    res.status(500).json({ error: 'Failed to delete area' });
  }
});

export default router;

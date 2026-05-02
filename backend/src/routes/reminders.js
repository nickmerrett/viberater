import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all reminders for user
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM reminders WHERE user_id = $1 ORDER BY completed ASC, due_date ASC, created_at DESC`,
      [req.user.userId]
    );
    res.json({ reminders: result.rows });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// Create reminder
router.post('/', async (req, res) => {
  try {
    const { title, note, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await query(
      `INSERT INTO reminders (user_id, title, note, due_date) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.userId, title, note || null, due_date || null]
    );
    res.status(201).json({ reminder: result.rows[0] });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// Update reminder
router.put('/:id', async (req, res) => {
  try {
    const { title, note, due_date } = req.body;
    const result = await query(
      `UPDATE reminders SET title = COALESCE($1, title), note = COALESCE($2, note), due_date = COALESCE($3, due_date)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [title, note, due_date, req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ reminder: result.rows[0] });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// Complete / uncomplete reminder
router.patch('/:id/complete', async (req, res) => {
  try {
    const result = await query(
      `UPDATE reminders SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ reminder: result.rows[0] });
  } catch (error) {
    console.error('Complete reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// Delete reminder
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

export default router;

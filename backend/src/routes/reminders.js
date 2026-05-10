import express from 'express';
import { db, generateUUID } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const reminders = await db('reminders')
      .where({ user_id: req.user.userId })
      .orderBy([{ column: 'completed' }, { column: 'due_date' }, { column: 'created_at', order: 'desc' }]);
    res.json({ reminders });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, note, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const [reminder] = await db('reminders').insert({
      id: generateUUID(),
      user_id: req.user.userId,
      title,
      note: note || null,
      due_date: due_date || null,
    }).returning('*');

    res.status(201).json({ reminder });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, note, due_date } = req.body;
    const updates = {};
    if (title    !== undefined) updates.title    = title;
    if (note     !== undefined) updates.note     = note;
    if (due_date !== undefined) updates.due_date = due_date;

    const [reminder] = await db('reminders')
      .where({ id: req.params.id, user_id: req.user.userId })
      .update(updates).returning('*');

    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ reminder });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

router.patch('/:id/complete', async (req, res) => {
  try {
    const existing = await db('reminders').where({ id: req.params.id, user_id: req.user.userId }).first();
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });

    const [reminder] = await db('reminders')
      .where({ id: req.params.id, user_id: req.user.userId })
      .update({ completed: existing.completed ? 0 : 1 })
      .returning('*');

    res.json({ reminder });
  } catch (error) {
    console.error('Complete reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await db('reminders').where({ id: req.params.id, user_id: req.user.userId }).del();
    if (!deleted) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

export default router;

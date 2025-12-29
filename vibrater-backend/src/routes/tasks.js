import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all tasks for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    // Verify project ownership
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.projectId, req.user.userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { status, priority } = req.query;

    let sql = `
      SELECT * FROM tasks
      WHERE project_id = $1
    `;
    const params = [req.params.projectId];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      sql += ` AND priority = $${params.length}`;
    }

    sql += ` ORDER BY sort_order, created_at`;

    const result = await query(sql, params);

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/project/:projectId', async (req, res) => {
  try {
    const { title, description, priority, estimatedMinutes, sortOrder } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify project ownership
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.projectId, req.user.userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await query(
      `INSERT INTO tasks (
        project_id, title, description, priority, estimated_minutes, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        req.params.projectId,
        title,
        description || null,
        priority || 'medium',
        estimatedMinutes || null,
        sortOrder || 0
      ]
    );

    res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      sortOrder,
      estimatedMinutes,
      actualMinutes
    } = req.body;

    // Verify task exists and user owns the project
    const existing = await query(
      `SELECT t.id FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 AND p.user_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        sort_order = COALESCE($5, sort_order),
        estimated_minutes = COALESCE($6, estimated_minutes),
        actual_minutes = COALESCE($7, actual_minutes)
      WHERE id = $8
      RETURNING *`,
      [
        title, description, status, priority,
        sortOrder, estimatedMinutes, actualMinutes,
        req.params.id
      ]
    );

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM tasks
       WHERE id = $1 AND project_id IN (
         SELECT id FROM projects WHERE user_id = $2
       )
       RETURNING id`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Complete task
router.post('/:id/complete', async (req, res) => {
  try {
    const result = await query(
      `UPDATE tasks SET
        status = 'completed',
        completed_at = NOW()
      WHERE id = $1 AND project_id IN (
        SELECT id FROM projects WHERE user_id = $2
      )
      RETURNING *`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Start task
router.post('/:id/start', async (req, res) => {
  try {
    const result = await query(
      `UPDATE tasks SET
        status = 'in-progress'
      WHERE id = $1 AND project_id IN (
        SELECT id FROM projects WHERE user_id = $2
      )
      RETURNING *`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ error: 'Failed to start task' });
  }
});

export default router;

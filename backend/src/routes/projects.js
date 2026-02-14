import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all projects
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT p.*, i.title as origin_idea_title
      FROM projects p
      LEFT JOIN ideas i ON p.origin_idea_id = i.id
      WHERE p.user_id = $1
    `;
    const params = [req.user.userId];

    if (status) {
      params.push(status);
      sql += ` AND p.status = $${params.length}`;
    }

    sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM projects WHERE user_id = $1',
      [req.user.userId]
    );

    res.json({
      projects: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Math.floor(offset / limit) + 1
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project with tasks
router.get('/:id', async (req, res) => {
  try {
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get tasks for this project
    const tasksResult = await query(
      'SELECT * FROM tasks WHERE project_id = $1 ORDER BY sort_order, created_at',
      [req.params.id]
    );

    // Get recent AI conversations
    const aiChatsResult = await query(
      `SELECT id, context_type, ai_provider, created_at, updated_at
       FROM ai_conversations
       WHERE project_id = $1
       ORDER BY updated_at DESC LIMIT 5`,
      [req.params.id]
    );

    // Update last_worked_on
    await query(
      'UPDATE projects SET last_worked_on = NOW() WHERE id = $1',
      [req.params.id]
    );

    res.json({
      project,
      tasks: tasksResult.rows,
      recentAIChats: aiChatsResult.rows
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      originIdeaId,
      techStack,
      vibe,
      excitement,
      targetCompletionDate
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await query(
      `INSERT INTO projects (
        user_id, title, description, origin_idea_id,
        tech_stack, vibe, excitement, target_completion_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        req.user.userId,
        title,
        description || null,
        originIdeaId || null,
        techStack || [],
        vibe || [],
        excitement || null,
        targetCompletionDate || null
      ]
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      completionPercent,
      techStack,
      vibe,
      excitement,
      targetCompletionDate,
      repositoryUrl,
      repositoryBranch,
      repositoryLocalPath
    } = req.body;

    // Verify ownership
    const existing = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await query(
      `UPDATE projects SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        completion_percent = COALESCE($4, completion_percent),
        tech_stack = COALESCE($5, tech_stack),
        vibe = COALESCE($6, vibe),
        excitement = COALESCE($7, excitement),
        target_completion_date = COALESCE($8, target_completion_date),
        repository_url = COALESCE($9, repository_url),
        repository_branch = COALESCE($10, repository_branch),
        repository_local_path = COALESCE($11, repository_local_path),
        last_worked_on = NOW()
      WHERE id = $12 AND user_id = $13
      RETURNING *`,
      [
        title, description, status, completionPercent,
        techStack, vibe, excitement, targetCompletionDate,
        repositoryUrl, repositoryBranch, repositoryLocalPath,
        req.params.id, req.user.userId
      ]
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Start project
router.post('/:id/start', async (req, res) => {
  try {
    const result = await query(
      `UPDATE projects SET
        status = 'in-progress',
        started_at = COALESCE(started_at, NOW()),
        last_worked_on = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Start project error:', error);
    res.status(500).json({ error: 'Failed to start project' });
  }
});

// Complete project
router.post('/:id/complete', async (req, res) => {
  try {
    const result = await query(
      `UPDATE projects SET
        status = 'completed',
        completion_percent = 100,
        completed_at = NOW(),
        last_worked_on = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Complete project error:', error);
    res.status(500).json({ error: 'Failed to complete project' });
  }
});

// Demote project back to idea
router.post('/:id/demote', async (req, res) => {
  try {
    // Get the project
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    if (!project.origin_idea_id) {
      return res.status(400).json({ error: 'Project has no origin idea to demote to' });
    }

    // Get the original idea
    const ideaResult = await query(
      'SELECT * FROM ideas WHERE id = $1 AND user_id = $2',
      [project.origin_idea_id, req.user.userId]
    );

    if (ideaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Original idea not found' });
    }

    // Restore the idea - clear project_id and reset status
    await query(
      `UPDATE ideas SET
        status = 'refined',
        project_id = NULL
      WHERE id = $1`,
      [project.origin_idea_id]
    );

    // Delete the project
    await query(
      'DELETE FROM projects WHERE id = $1',
      [req.params.id]
    );

    // Fetch the updated idea
    const updatedIdea = await query(
      'SELECT * FROM ideas WHERE id = $1',
      [project.origin_idea_id]
    );

    res.json({ idea: updatedIdea.rows[0] });
  } catch (error) {
    console.error('Demote project error:', error);
    res.status(500).json({ error: 'Failed to demote project' });
  }
});

export default router;

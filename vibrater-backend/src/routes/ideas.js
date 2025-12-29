import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all ideas
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT * FROM ideas
      WHERE user_id = $1
    `;
    const params = [req.user.userId];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM ideas WHERE user_id = $1',
      [req.user.userId]
    );

    res.json({
      ideas: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Math.floor(offset / limit) + 1
    });
  } catch (error) {
    console.error('Get ideas error:', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

// Get single idea
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Update last_viewed_at
    await query(
      'UPDATE ideas SET last_viewed_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    res.json({ idea: result.rows[0] });
  } catch (error) {
    console.error('Get idea error:', error);
    res.status(500).json({ error: 'Failed to fetch idea' });
  }
});

// Create idea
router.post('/', async (req, res) => {
  try {
    const {
      title,
      summary,
      transcript,
      conversation,
      vibe,
      excitement,
      complexity,
      techStack,
      notes,
      links,
      tags,
      parent_idea_id,
      related_ideas
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await query(
      `INSERT INTO ideas (
        user_id, title, summary, transcript, conversation,
        vibe, excitement, complexity, tech_stack, notes, links, tags,
        parent_idea_id, related_ideas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        req.user.userId,
        title,
        summary || null,
        transcript || null,
        conversation || null,
        vibe || [],
        excitement || null,
        complexity || null,
        techStack || [],
        notes || null,
        links || [],
        tags || [],
        parent_idea_id || null,
        related_ideas || []
      ]
    );

    res.status(201).json({ idea: result.rows[0] });
  } catch (error) {
    console.error('Create idea error:', error);
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

// Update idea
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      summary,
      transcript,
      conversation,
      vibe,
      excitement,
      complexity,
      techStack,
      status,
      notes,
      links,
      tags,
      archived,
      related_ideas,
      parent_idea_id
    } = req.body;

    // Verify ownership
    const existing = await query(
      'SELECT id FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const result = await query(
      `UPDATE ideas SET
        title = COALESCE($1, title),
        summary = COALESCE($2, summary),
        transcript = COALESCE($3, transcript),
        conversation = COALESCE($4, conversation),
        vibe = COALESCE($5, vibe),
        excitement = COALESCE($6, excitement),
        complexity = COALESCE($7, complexity),
        tech_stack = COALESCE($8, tech_stack),
        status = COALESCE($9, status),
        notes = COALESCE($10, notes),
        links = COALESCE($11, links),
        tags = COALESCE($12, tags),
        archived = COALESCE($13, archived),
        related_ideas = COALESCE($14, related_ideas),
        parent_idea_id = COALESCE($15, parent_idea_id)
      WHERE id = $16 AND user_id = $17
      RETURNING *`,
      [
        title, summary, transcript, conversation,
        vibe, excitement, complexity, techStack,
        status, notes, links, tags, archived,
        related_ideas, parent_idea_id,
        req.params.id, req.user.userId
      ]
    );

    res.json({ idea: result.rows[0] });
  } catch (error) {
    console.error('Update idea error:', error);
    res.status(500).json({ error: 'Failed to update idea' });
  }
});

// Delete idea
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM ideas WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete idea error:', error);
    res.status(500).json({ error: 'Failed to delete idea' });
  }
});

// Save refined idea from AI conversation
router.patch('/:id/refine', async (req, res) => {
  try {
    const { conversation, refinedData } = req.body;

    // Verify ownership
    const existing = await query(
      'SELECT id FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Update idea with refined conversation and extracted data
    const result = await query(
      `UPDATE ideas SET
        conversation = $1,
        summary = COALESCE($2, summary),
        design_document = COALESCE($3, design_document),
        tech_stack = COALESCE($4, tech_stack),
        notes = COALESCE($5, notes),
        status = COALESCE($6, status)
      WHERE id = $7 AND user_id = $8
      RETURNING *`,
      [
        JSON.stringify(conversation),
        refinedData?.summary,
        refinedData?.designDocument,
        refinedData?.techStack,
        refinedData?.notes,
        refinedData?.status || 'refined',
        req.params.id,
        req.user.userId
      ]
    );

    res.json({ idea: result.rows[0] });
  } catch (error) {
    console.error('Refine idea error:', error);
    res.status(500).json({ error: 'Failed to save refined idea' });
  }
});

// Promote idea to project
router.post('/:id/promote', async (req, res) => {
  try {
    const {
      projectTitle,
      projectDescription,
      goals,
      phases,
      initialTasks,
      techStack,
      estimatedDuration
    } = req.body;

    // Get the idea
    const ideaResult = await query(
      'SELECT * FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (ideaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const idea = ideaResult.rows[0];

    // Build project plan JSONB
    const projectPlan = {
      goals: goals || [],
      phases: phases || [],
      estimatedDuration: estimatedDuration || null
    };

    // Create project from idea
    const projectResult = await query(
      `INSERT INTO projects (
        user_id, origin_idea_id, title, description,
        tech_stack, vibe, excitement, status, project_plan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'planning', $8)
      RETURNING *`,
      [
        req.user.userId,
        idea.id,
        projectTitle || idea.title,
        projectDescription || idea.summary,
        techStack || idea.tech_stack || [],
        idea.vibe || [],
        idea.excitement,
        JSON.stringify(projectPlan)
      ]
    );

    const project = projectResult.rows[0];

    // Create initial tasks if provided
    if (initialTasks && initialTasks.length > 0) {
      for (let i = 0; i < initialTasks.length; i++) {
        const task = initialTasks[i];
        await query(
          `INSERT INTO tasks (
            project_id, title, description, priority,
            estimated_minutes, ai_generated, sort_order
          ) VALUES ($1, $2, $3, $4, $5, true, $6)`,
          [
            project.id,
            task.title,
            task.description || null,
            task.priority || 'medium',
            task.estimatedMinutes || null,
            i + 1
          ]
        );
      }
    }

    // Update idea status and link to project
    await query(
      `UPDATE ideas SET status = 'promoted-to-project', project_id = $1
       WHERE id = $2`,
      [project.id, idea.id]
    );

    // Fetch tasks for the response
    const tasksResult = await query(
      'SELECT * FROM tasks WHERE project_id = $1 ORDER BY sort_order',
      [project.id]
    );

    res.status(201).json({
      project,
      tasks: tasksResult.rows
    });
  } catch (error) {
    console.error('Promote idea error:', error);
    res.status(500).json({ error: 'Failed to promote idea' });
  }
});

export default router;

import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const REACTIONS = ['👍', '💡', '🔥'];

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + (process.env.JWT_SECRET || 'salt')).digest('hex').slice(0, 32);
}

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req) => `${hashIp(req.ip)}-${req.params.token}`,
  handler: (req, res) => res.status(429).json({ error: 'Too many comments — try again later.' }),
  skip: () => process.env.NODE_ENV !== 'production',
});

const reactionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10,
  keyGenerator: (req) => `${hashIp(req.ip)}-${req.params.token}-react`,
  handler: (req, res) => res.status(429).json({ error: 'Too many reactions.' }),
  skip: () => process.env.NODE_ENV !== 'production',
});

// ── Public routes (no auth) ──────────────────────────────────────────────────

// GET /api/share/:token — fetch shared idea
router.get('/:token', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, summary, tags, vibe, excitement, complexity, notes, design_document, created_at
       FROM ideas WHERE share_token = $1 AND sharing_enabled = 1`,
      [req.params.token]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Shared idea not found' });

    const idea = result.rows[0];

    // Fetch reactions summary
    const reactions = await query(
      `SELECT reaction, COUNT(*) as count FROM idea_reactions WHERE idea_id = $1 GROUP BY reaction`,
      [idea.id]
    );

    // Fetch comments (newest first)
    const comments = await query(
      `SELECT id, author_name, content, is_author_reply, created_at
       FROM idea_comments WHERE idea_id = $1 ORDER BY created_at ASC`,
      [idea.id]
    );

    res.json({
      idea,
      reactions: reactions.rows,
      comments: comments.rows,
    });
  } catch (error) {
    console.error('Get shared idea error:', error);
    res.status(500).json({ error: 'Failed to load shared idea' });
  }
});

// POST /api/share/:token/react
router.post('/:token/react', reactionLimiter, async (req, res) => {
  try {
    const { reaction } = req.body;
    if (!REACTIONS.includes(reaction)) return res.status(400).json({ error: 'Invalid reaction' });

    const idea = await query(
      'SELECT id FROM ideas WHERE share_token = $1 AND sharing_enabled = 1',
      [req.params.token]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const ipHash = hashIp(req.ip);

    // Toggle: remove if exists, add if not
    const existing = await query(
      'SELECT id FROM idea_reactions WHERE idea_id = $1 AND reaction = $2 AND ip_hash = $3',
      [idea.rows[0].id, reaction, ipHash]
    );

    if (existing.rows.length > 0) {
      await query('DELETE FROM idea_reactions WHERE id = $1', [existing.rows[0].id]);
    } else {
      await query(
        'INSERT INTO idea_reactions (idea_id, reaction, ip_hash) VALUES ($1, $2, $3)',
        [idea.rows[0].id, reaction, ipHash]
      );
    }

    const updated = await query(
      'SELECT reaction, COUNT(*) as count FROM idea_reactions WHERE idea_id = $1 GROUP BY reaction',
      [idea.rows[0].id]
    );

    res.json({ reactions: updated.rows });
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

// POST /api/share/:token/comment
router.post('/:token/comment', commentLimiter, async (req, res) => {
  try {
    const { author_name, content } = req.body;
    if (!author_name?.trim()) return res.status(400).json({ error: 'Name required' });
    if (!content?.trim()) return res.status(400).json({ error: 'Comment required' });
    if (content.length > 2000) return res.status(400).json({ error: 'Comment too long (max 2000 chars)' });
    if (author_name.length > 100) return res.status(400).json({ error: 'Name too long' });

    const idea = await query(
      'SELECT id FROM ideas WHERE share_token = $1 AND sharing_enabled = 1',
      [req.params.token]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const ipHash = hashIp(req.ip);
    const ideaId = idea.rows[0].id;

    const result = await query(
      `INSERT INTO idea_comments (idea_id, author_name, content, ip_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, author_name, content, is_author_reply, created_at`,
      [ideaId, author_name.trim(), content.trim(), ipHash]
    );

    // Increment unread count for idea owner
    await query(
      'UPDATE ideas SET unread_comment_count = unread_comment_count + 1 WHERE id = $1',
      [ideaId]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ── Author routes (auth required) ────────────────────────────────────────────

// PATCH /api/share/manage/:ideaId — toggle sharing
router.patch('/manage/:ideaId', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    const ideaId = req.params.ideaId;

    const idea = await query(
      'SELECT id, share_token, sharing_enabled FROM ideas WHERE id = $1 AND user_id = $2',
      [ideaId, req.user.userId]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Idea not found' });

    let shareToken = idea.rows[0].share_token;

    if (enabled) {
      // Always generate a fresh token when enabling (revokes old link)
      shareToken = crypto.randomUUID();
      await query(
        'UPDATE ideas SET sharing_enabled = 1, share_token = $1 WHERE id = $2',
        [shareToken, ideaId]
      );
    } else {
      await query(
        'UPDATE ideas SET sharing_enabled = 0 WHERE id = $1',
        [ideaId]
      );
      shareToken = null;
    }

    res.json({ sharing_enabled: enabled, share_token: shareToken });
  } catch (error) {
    console.error('Toggle sharing error:', error);
    res.status(500).json({ error: 'Failed to update sharing' });
  }
});

// GET /api/share/manage/:ideaId/comments — author views all comments
router.get('/manage/:ideaId/comments', authenticateToken, async (req, res) => {
  try {
    const idea = await query(
      'SELECT id FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.ideaId, req.user.userId]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Idea not found' });

    const comments = await query(
      `SELECT id, author_name, content, is_author_reply, created_at
       FROM idea_comments WHERE idea_id = $1 ORDER BY created_at ASC`,
      [req.params.ideaId]
    );

    // Clear unread count
    await query('UPDATE ideas SET unread_comment_count = 0 WHERE id = $1', [req.params.ideaId]);

    res.json({ comments: comments.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/share/manage/:ideaId/comments — author reply
router.post('/manage/:ideaId/comments', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    if (content.length > 2000) return res.status(400).json({ error: 'Too long' });

    const idea = await query(
      'SELECT id FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.ideaId, req.user.userId]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Idea not found' });

    const result = await query(
      `INSERT INTO idea_comments (idea_id, author_name, content, is_author_reply)
       VALUES ($1, 'Author', $2, 1) RETURNING id, author_name, content, is_author_reply, created_at`,
      [req.params.ideaId, content.trim()]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

// DELETE /api/share/manage/:ideaId/comments/:commentId
router.delete('/manage/:ideaId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const idea = await query(
      'SELECT id FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.ideaId, req.user.userId]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Idea not found' });

    await query(
      'DELETE FROM idea_comments WHERE id = $1 AND idea_id = $2',
      [req.params.commentId, req.params.ideaId]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;

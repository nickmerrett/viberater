import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const STORAGE_DIR = process.env.STORAGE_ROOT
  ? path.join(process.env.STORAGE_ROOT, '..', 'attachments')
  : './storage/attachments';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
];

await fs.ensureDir(STORAGE_DIR);

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(STORAGE_DIR, req.user.userId);
    await fs.ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// GET /api/attachments/idea/:ideaId
router.get('/idea/:ideaId', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM attachments WHERE idea_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [req.params.ideaId, req.user.userId]
    );
    res.json({ attachments: result.rows.map(parseAttachment) });
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// POST /api/attachments/upload/:ideaId — image upload
router.post('/upload/:ideaId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    // Verify idea belongs to user
    const idea = await query(
      'SELECT id FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.ideaId, req.user.userId]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Idea not found' });

    const fileUrl = `/api/attachments/file/${req.user.userId}/${req.file.filename}`;

    const result = await query(
      `INSERT INTO attachments (idea_id, user_id, type, url, filename, size, mime_type)
       VALUES ($1, $2, 'image', $3, $4, $5, $6) RETURNING *`,
      [req.params.ideaId, req.user.userId, fileUrl,
       req.file.originalname, req.file.size, req.file.mimetype]
    );

    res.status(201).json({ attachment: parseAttachment(result.rows[0]) });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// POST /api/attachments/link/:ideaId — save a link
router.post('/link/:ideaId', async (req, res) => {
  try {
    const { url, title, description, favicon } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    // Basic URL validation
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const idea = await query(
      'SELECT id FROM ideas WHERE id = $1 AND user_id = $2',
      [req.params.ideaId, req.user.userId]
    );
    if (idea.rows.length === 0) return res.status(404).json({ error: 'Idea not found' });

    const metadata = JSON.stringify({ title, description, favicon });

    const result = await query(
      `INSERT INTO attachments (idea_id, user_id, type, url, filename, metadata)
       VALUES ($1, $2, 'link', $3, $4, $5) RETURNING *`,
      [req.params.ideaId, req.user.userId, url, title || url, metadata]
    );

    res.status(201).json({ attachment: parseAttachment(result.rows[0]) });
  } catch (error) {
    console.error('Link attachment error:', error);
    res.status(500).json({ error: 'Failed to save link' });
  }
});

// GET /api/attachments/file/:userId/:filename — serve file
router.get('/file/:userId/:filename', async (req, res) => {
  try {
    // Only serve files belonging to the authenticated user
    if (req.params.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Sanitise filename — no path traversal
    const filename = path.basename(req.params.filename);
    const filePath = path.join(STORAGE_DIR, req.params.userId, filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM attachments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });

    const attachment = result.rows[0];

    // Delete file from disk if it's an image we stored
    if (attachment.type === 'image' && attachment.url.startsWith('/api/attachments/file/')) {
      const filename = path.basename(attachment.url);
      const filePath = path.join(STORAGE_DIR, req.user.userId, filename);
      await fs.remove(filePath).catch(() => {});
    }

    await query('DELETE FROM attachments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

function parseAttachment(row) {
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

export default router;

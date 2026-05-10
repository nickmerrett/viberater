import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { db, generateUUID } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const STORAGE_DIR = process.env.STORAGE_ROOT
  ? path.join(process.env.STORAGE_ROOT, '..', 'attachments')
  : './storage/attachments';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

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

// POST /api/attachments/fetch-preview
router.post('/fetch-preview', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; viberater-bot/1.0)' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    const html = await response.text();

    const og = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
      return m?.[1] || null;
    };
    const meta = (name) => {
      const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'));
      return m?.[1] || null;
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const domain = new URL(url).origin;

    res.json({
      title: og('title') || meta('twitter:title') || titleMatch?.[1]?.trim() || null,
      description: og('description') || meta('description') || null,
      image: og('image') || null,
      favicon: `${domain}/favicon.ico`,
    });
  } catch {
    const domain = new URL(url).origin;
    res.json({ title: null, description: null, image: null, favicon: `${domain}/favicon.ico` });
  }
});

// GET /api/attachments/idea/:ideaId
router.get('/idea/:ideaId', async (req, res) => {
  try {
    const rows = await db('attachments')
      .where({ idea_id: req.params.ideaId, user_id: req.user.userId })
      .orderBy('created_at');
    res.json({ attachments: rows.map(parseAttachment) });
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// POST /api/attachments/upload/:ideaId
router.post('/upload/:ideaId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const idea = await db('ideas').where({ id: req.params.ideaId, user_id: req.user.userId }).first();
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const fileUrl = `/api/attachments/file/${req.user.userId}/${req.file.filename}`;
    const [row] = await db('attachments').insert({
      id: generateUUID(),
      idea_id: req.params.ideaId,
      user_id: req.user.userId,
      type: 'image',
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mime_type: req.file.mimetype,
    }).returning('*');

    res.status(201).json({ attachment: parseAttachment(row) });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// POST /api/attachments/link/:ideaId
router.post('/link/:ideaId', async (req, res) => {
  try {
    const { url, title, description, favicon } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const idea = await db('ideas').where({ id: req.params.ideaId, user_id: req.user.userId }).first();
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const [row] = await db('attachments').insert({
      id: generateUUID(),
      idea_id: req.params.ideaId,
      user_id: req.user.userId,
      type: 'link',
      url,
      filename: title || url,
      metadata: JSON.stringify({ title, description, favicon }),
    }).returning('*');

    res.status(201).json({ attachment: parseAttachment(row) });
  } catch (error) {
    console.error('Link attachment error:', error);
    res.status(500).json({ error: 'Failed to save link' });
  }
});

// GET /api/attachments/file/:userId/:filename
router.get('/file/:userId/:filename', async (req, res) => {
  try {
    if (req.params.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    const filename = path.basename(req.params.filename);
    const filePath = path.join(STORAGE_DIR, req.params.userId, filename);
    if (!await fs.pathExists(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', async (req, res) => {
  try {
    const attachment = await db('attachments').where({ id: req.params.id, user_id: req.user.userId }).first();
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    if (attachment.type === 'image' && attachment.url.startsWith('/api/attachments/file/')) {
      const filename = path.basename(attachment.url);
      await fs.remove(path.join(STORAGE_DIR, req.user.userId, filename)).catch(() => {});
    }

    await db('attachments').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

function parseAttachment(row) {
  return {
    ...row,
    metadata: row.metadata
      ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
      : null,
  };
}

export default router;

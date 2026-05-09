import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';

// Import routes (will create these next)
import authRoutes from './routes/auth.js';
import ideasRoutes from './routes/ideas.js';
import projectsRoutes from './routes/projects.js';
import tasksRoutes from './routes/tasks.js';
import aiRoutes from './routes/ai.js';
import gitRoutes from './routes/git.js';
import syncRoutes from './routes/sync.js';
import remindersRoutes from './routes/reminders.js';
import captureRoutes from './routes/capture.js';
import areasRoutes, { bootstrapAreas } from './routes/areas.js';
import attachmentsRoutes from './routes/attachments.js';
import shareRoutes from './routes/share.js';
import researchRoutes from './routes/research.js';
import { query } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - we're behind nginx
app.set('trust proxy', 1);

// Disable ETags — prevents browser returning stale 304 responses for API data
app.disable('etag');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// CORS - supports comma-separated list of allowed origins in CORS_ORIGIN
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : null;
app.use(cors({
  origin: corsOrigins
    ? (corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins)
    : (process.env.NODE_ENV !== 'production' ? true : false),
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const rateLimitHandler = (req, res) => {
  res.status(429).json({ error: 'Too many requests, please try again later.' });
};

// General API rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV !== 'production',
});

// Strict limit for auth endpoints — brute force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV !== 'production',
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/capture', captureRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/attachments', attachmentsRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/research', researchRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Ensure storage directory exists
const storageRoot = process.env.STORAGE_ROOT || './storage/projects';
await fs.ensureDir(storageRoot);
await fs.ensureDir('./logs');

// Purge expired refresh tokens daily
async function purgeExpiredTokens() {
  try {
    const result = await query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
    if (result.rowCount > 0) console.log(`[auth] Purged ${result.rowCount} expired refresh tokens`);
  } catch (e) {
    if (!e.message?.includes('no such table')) {
      console.error('[auth] Token purge failed:', e.message);
    }
  }
}
purgeExpiredTokens();
setInterval(purgeExpiredTokens, 24 * 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🎤 viberater Backend API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ API endpoint: http://localhost:${PORT}/api`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

export default app;

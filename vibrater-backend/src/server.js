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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - we're behind nginx
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true, // Allow all origins in development
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // Increased from 100
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many requests, please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  },
  // Skip in development
  skip: (req) => process.env.NODE_ENV !== 'production'
});

// Only apply rate limiting in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/sync', syncRoutes);

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

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🎤 Vibrater Backend API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ API endpoint: http://localhost:${PORT}/api`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

export default app;

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get sync data (stub for Phase 5)
router.get('/', async (req, res) => {
  try {
    res.status(501).json({
      error: 'Sync not implemented yet',
      message: 'This feature will be available in Phase 5'
    });
  } catch (error) {
    console.error('Sync get error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Push sync data (stub for Phase 5)
router.post('/', async (req, res) => {
  try {
    res.status(501).json({
      error: 'Sync not implemented yet',
      message: 'This feature will be available in Phase 5'
    });
  } catch (error) {
    console.error('Sync post error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;

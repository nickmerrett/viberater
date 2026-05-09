import express from 'express';
import authRoutes from '../src/routes/auth.js';
import ideasRoutes from '../src/routes/ideas.js';
import areasRoutes from '../src/routes/areas.js';
import remindersRoutes from '../src/routes/reminders.js';
import shareRoutes from '../src/routes/share.js';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/share', shareRoutes);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

export default app;

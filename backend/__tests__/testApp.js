import express from 'express';
import authRoutes from '../src/routes/auth.js';
import ideasRoutes from '../src/routes/ideas.js';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/ideas', ideasRoutes);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

export default app;

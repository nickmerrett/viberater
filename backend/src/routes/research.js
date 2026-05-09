import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { aiService } from '../services/aiService.js';
import { TOOLS } from '../services/toolService.js';

const router = express.Router();
router.use(authenticateToken);

const SYSTEM_PROMPT = `You are a research assistant helping validate and contextualise ideas.
When given an idea, use web_search and fetch_url to find:
- Existing products or projects that do something similar
- Key competitors or alternatives
- Relevant market context or community discussions

Be concise. After researching, summarise what you found in 3-5 bullet points:
- What already exists
- How similar it is to the idea
- Any gaps or differentiation opportunities

Do not ask clarifying questions — just research and report.`;

// POST /api/research/idea — stream an agentic research run for an idea
router.post('/idea', async (req, res) => {
  const { title, summary } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const query = summary ? `${title}: ${summary}` : title;
    const messages = [{ role: 'user', content: `Research this idea: ${query}` }];

    await aiService.runWithTools(messages, TOOLS, (event) => send(event), {
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error('Research error:', error);
    send({ type: 'error', message: error.message });
  }

  res.end();
});

export default router;

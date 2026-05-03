import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { aiService } from '../services/aiService.js';

const router = express.Router();
router.use(authenticateToken);

const RETENTION_DAYS = 60;
const CONTEXT_MESSAGES = 40;

async function resolveAreaId(userId, areaName) {
  if (!areaName) return null;
  try {
    const result = await query(
      `SELECT id FROM areas WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [userId, areaName]
    );
    return result.rows[0]?.id || null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(areas, recentIdeas) {
  const areaList = areas.length
    ? areas.map(a => a.name).join(', ')
    : 'work, personal, home (default - user has not set up areas yet)';

  const ideaList = recentIdeas.length
    ? recentIdeas.map(i => `- ${i.title} (${i.created_at?.split('T')[0]})`).join('\n')
    : 'none yet';

  return `You are a friendly capture assistant inside viberater, a personal idea management app. Help the user capture and develop ideas through natural conversation - like texting a smart friend who genuinely finds their ideas interesting.

Ideas can be ANYTHING - tech projects, garden designs, home renovations, recipes, travel plans, blog posts, business ideas, creative projects, things to research, purchases to consider. Don't assume tech context.

STYLE:
- Short responses (1-3 sentences max). This is messaging, not essays.
- Ask ONE follow-up question at a time to flesh out the idea
- Warm and curious - genuinely interested, not formal
- Use casual language, contractions, be natural
- Match the energy of the idea - excited about a garden plan? Be enthusiastic.

FLOW:
1. User shares a rough thought → ask one good question to develop it
2. After 1-2 exchanges you have enough → tell them what you're capturing
3. Infer the area from context clues, confirm casually: "sounds like a home project — saving it there, yeah?"
4. Before saving, ask "any obvious next steps?" — one question, not a form
5. Once you have next steps (or they say none), output the CAPTURE block

AREAS AVAILABLE: ${areaList}

RECENT IDEAS (for cross-referencing):
${ideaList}

CAPTURE FORMAT:
When ready to save, end your message with this exact format on its own line:
CAPTURE:{"title":"...","summary":"...","area":"...","tags":["..."],"next_steps":["step 1","step 2"],"excitement":7,"complexity":"weekend","vibe":["creative","practical"]}

FIELD GUIDANCE (infer from the conversation, don't ask):
- excitement: 1-10 based on how animated/enthusiastic the user seems. Casual mention = 5, clearly excited = 8-9, life-changing = 10
- complexity: one of "afternoon", "weekend", "week", "month", "months" — based on scope described
- vibe: 1-3 mood/feel words that capture the nature of the idea (e.g. "creative", "practical", "ambitious", "relaxing", "technical", "personal", "fun")
- next_steps: short actionable strings, empty array [] if none mentioned

Everything before the CAPTURE line is shown to the user. The CAPTURE line is stripped silently.

If the user is just chatting or asking something (not capturing an idea), respond naturally with no CAPTURE block.
After a capture: acknowledge briefly and stay in the conversation naturally.`;
}

// Get conversation history
router.get('/messages', async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const result = await query(
      `SELECT id, role, content, created_at FROM capture_messages
       WHERE user_id = $1 AND created_at > $2
       ORDER BY created_at ASC`,
      [req.user.userId, cutoff.toISOString()]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get capture messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/chat', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content required' });

    const userId = req.user.userId;

    // Save user message
    const userMsg = await query(
      `INSERT INTO capture_messages (user_id, role, content) VALUES ($1, 'user', $2) RETURNING *`,
      [userId, content.trim()]
    );

    // Get recent history for AI context
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const history = await query(
      `SELECT role, content FROM capture_messages
       WHERE user_id = $1 AND created_at > $2
       ORDER BY created_at ASC
       LIMIT $3`,
      [userId, cutoff.toISOString(), CONTEXT_MESSAGES]
    );

    // Get user's areas
    let areas = [];
    try {
      const areasResult = await query(
        `SELECT name FROM areas WHERE user_id = $1 ORDER BY sort_order ASC`,
        [userId]
      );
      areas = areasResult.rows;
    } catch {
      // areas table may not exist yet
    }

    // Get recent ideas for cross-reference
    const recentIdeas = await query(
      `SELECT title, created_at FROM ideas WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );

    const systemPrompt = buildSystemPrompt(areas, recentIdeas.rows);

    // Call AI with plain text response (not JSON)
    const aiMessages = history.rows.map(m => ({ role: m.role, content: m.content }));

    const aiResponse = await aiService.chatRaw(aiMessages, { systemPrompt });
    const fullContent = aiResponse.content;

    // Parse out CAPTURE block(s) if present
    const captureRegex = /^CAPTURE:(\{.+\})\s*$/gm;
    const captures = [];
    let match;
    while ((match = captureRegex.exec(fullContent)) !== null) {
      try {
        captures.push(JSON.parse(match[1]));
      } catch {
        // malformed capture block, skip
      }
    }

    // Clean response shown to user (strip CAPTURE lines)
    const displayContent = fullContent.replace(/^CAPTURE:\{.+\}\s*$/gm, '').trim();

    // Save assistant message
    const assistantMsg = await query(
      `INSERT INTO capture_messages (user_id, role, content) VALUES ($1, 'assistant', $2) RETURNING *`,
      [userId, displayContent]
    );

    // Save any captured ideas
    const savedIdeas = [];
    for (const capture of captures) {
      try {
        const nextSteps = capture.next_steps?.length
          ? `Next steps:\n${capture.next_steps.map(s => `- ${s}`).join('\n')}`
          : null;

        const ideaResult = await query(
          `INSERT INTO ideas (user_id, title, summary, tags, notes, vibe, excitement, complexity, area_id, capture_message_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            userId,
            capture.title,
            capture.summary || null,
            JSON.stringify(capture.tags || []),
            nextSteps,
            JSON.stringify(capture.vibe || []),
            capture.excitement || null,
            capture.complexity || null,
            await resolveAreaId(userId, capture.area),
            assistantMsg.rows[0].id,
          ]
        );
        savedIdeas.push(ideaResult.rows[0]);
      } catch (e) {
        console.error('Failed to save captured idea:', e);
      }
    }

    res.json({
      message: {
        id: assistantMsg.rows[0].id,
        role: 'assistant',
        content: displayContent,
        created_at: assistantMsg.rows[0].created_at,
      },
      captured: savedIdeas,
    });
  } catch (error) {
    console.error('Capture chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Streaming chat endpoint — SSE
router.post('/stream', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message content required' });

  const userId = req.user.userId;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // Save user message
    await query(
      `INSERT INTO capture_messages (user_id, role, content) VALUES ($1, 'user', $2)`,
      [userId, content.trim()]
    );

    // Get history
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const history = await query(
      `SELECT role, content FROM capture_messages
       WHERE user_id = $1 AND created_at > $2
       ORDER BY created_at ASC LIMIT $3`,
      [userId, cutoff.toISOString(), CONTEXT_MESSAGES]
    );

    // Get areas and recent ideas for context
    let areas = [];
    try {
      const ar = await query(`SELECT name FROM areas WHERE user_id = $1 ORDER BY sort_order ASC`, [userId]);
      areas = ar.rows;
    } catch { /* areas table may not exist yet */ }

    const recentIdeas = await query(
      `SELECT title, created_at FROM ideas WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );

    const systemPrompt = buildSystemPrompt(areas, recentIdeas.rows);
    const aiMessages = history.rows.map(m => ({ role: m.role, content: m.content }));

    // Stream tokens to client
    let fullContent = '';
    await aiService.streamRaw(aiMessages, { systemPrompt }, (token) => {
      fullContent += token;
      send({ type: 'token', text: token });
    });

    // Parse CAPTURE blocks from full response
    const captureRegex = /^CAPTURE:(\{.+\})\s*$/gm;
    const captures = [];
    let match;
    while ((match = captureRegex.exec(fullContent)) !== null) {
      try { captures.push(JSON.parse(match[1])); } catch { /* skip malformed */ }
    }

    const displayContent = fullContent.replace(/^CAPTURE:\{.+\}\s*$/gm, '').trim();

    // Save assistant message
    const assistantMsg = await query(
      `INSERT INTO capture_messages (user_id, role, content) VALUES ($1, 'assistant', $2) RETURNING *`,
      [userId, displayContent]
    );

    // Save captured ideas
    const savedIdeas = [];
    for (const capture of captures) {
      try {
        const nextSteps = capture.next_steps?.length
          ? `Next steps:\n${capture.next_steps.map(s => `- ${s}`).join('\n')}`
          : null;

        const ideaResult = await query(
          `INSERT INTO ideas (user_id, title, summary, tags, notes, vibe, excitement, complexity, capture_message_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [userId, capture.title, capture.summary || null,
           JSON.stringify(capture.tags || []), nextSteps,
           JSON.stringify(capture.vibe || []), capture.excitement || null,
           capture.complexity || null, assistantMsg.rows[0].id]
        );
        savedIdeas.push(ideaResult.rows[0]);
      } catch (e) {
        console.error('Failed to save captured idea:', e);
      }
    }

    // Final event
    send({
      type: 'done',
      messageId: assistantMsg.rows[0].id,
      created_at: assistantMsg.rows[0].created_at,
      captured: savedIdeas,
    });

    res.end();
  } catch (error) {
    console.error('Capture stream error:', error);
    send({ type: 'error', message: error.message });
    res.end();
  }
});

export default router;

import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

class AIService {
  constructor() {
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'openrouter';

    // Initialize OpenRouter (OpenAI-compatible)
    if (process.env.OPENROUTER_API_KEY) {
      this.openrouter = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }

    // Ollama base URL (local inference, kept as-is)
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  /**
   * Chat with AI for idea refinement
   * @param {Array} messages - Chat history [{ role: 'user'|'assistant', content: string }]
   * @param {Object} options - { provider, model, systemPrompt }
   */
  async chat(messages, options = {}) {
    const provider = options.provider || this.defaultProvider;

    switch (provider) {
      case 'openrouter':
      case 'openai':
      case 'claude':  // legacy — route to openrouter
        return this.chatOpenRouter(messages, options);
      case 'ollama':
        return this.chatOllama(messages, options);
      default:
        return this.chatOpenRouter(messages, options);
    }
  }

  // Plain text chat — no JSON parsing, used for conversational capture
  async chatRaw(messages, options = {}) {
    const opts = { ...options, maxTokens: 512 };
    return this.chatOpenRouter(messages, opts);
  }

  // Streaming chat — calls onToken(text) for each chunk, returns full content
  async streamRaw(messages, options = {}, onToken) {
    return this.streamOpenRouter(messages, options, onToken);
  }

  async streamOpenRouter(messages, options = {}, onToken) {
    if (!this.openrouter) throw new Error('OPENROUTER_API_KEY not configured');

    const systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    const model = options.model || process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct';
    let fullContent = '';

    const stream = await this.openrouter.chat.completions.create({
      model,
      max_tokens: options.maxTokens || 512,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        fullContent += text;
        onToken(text);
      }
    }

    return { content: fullContent };
  }

  async chatOpenRouter(messages, options = {}) {
    if (!this.openrouter) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    const model = options.model || process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct';

    try {
      const response = await this.openrouter.chat.completions.create({
        model,
        max_tokens: options.maxTokens || 1024,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        ],
      });

      return {
        content: response.choices[0].message.content,
        provider: 'openrouter',
        model: response.model,
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        },
      };
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
  }

  async chatOllama(messages, options = {}) {
    const systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    const model = options.model || 'llama2';

    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: data.message.content,
        provider: 'ollama',
        model: data.model,
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
        },
      };
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  /**
   * Get idea refinement system prompt
   */
  getDefaultSystemPrompt() {
    return `You are an AI assistant helping developers refine their project ideas through interactive conversation.

CRITICAL GUIDELINES:
- Keep responses SHORT (2-4 sentences max)
- Ask 1-2 specific questions per response
- Be conversational and friendly, not formal
- Wait for answers before asking more questions
- Focus on one aspect at a time
- Use the Socratic method - guide them with questions rather than lecturing
- Be encouraging and enthusiastic about their ideas

RESPONSE FORMAT - CRITICAL:
You MUST respond with ONLY valid JSON and NOTHING ELSE.
Do NOT add any conversational text before or after the JSON.
Do NOT wrap the JSON in markdown code fences.
ONLY return the raw JSON object in this exact format:
{
  "message": "Your conversational response here (2-3 sentences)",
  "questions": [
    {
      "question": "What's your main use case?",
      "options": ["Option 1", "Option 2", "Option 3", "Other"]
    }
  ],
  "phase": "purpose",
  "progress": {
    "purpose": false,
    "users": false,
    "features": false,
    "implementation": false
  },
  "isComplete": false
}

IDEATION PHASES (in order):
1. **purpose** - Understand the problem and goals
2. **users** - Identify target users and use cases
3. **features** - Define key features and functionality
4. **implementation** - Discuss tech stack and approach

Rules:
- Ask 1-2 questions max per response
- Each question MUST have 3-5 clickable options
- Options should cover the likely answers
- Always include "Other" or "Something else" as last option
- Set progress[phase] = true when that phase is sufficiently covered
- Move to next phase only when current is complete
- Set isComplete = true when ALL phases are done (all true)
- Keep questions short and focused

Example response:
{
  "message": "Let's understand the core purpose first.",
  "questions": [
    {
      "question": "What problem are you solving?",
      "options": ["Save time", "Reduce costs", "Improve quality", "Other"]
    }
  ],
  "phase": "purpose",
  "progress": {
    "purpose": false,
    "users": false,
    "features": false,
    "implementation": false
  },
  "isComplete": false
}`;
  }

  /**
   * Generate idea refinement prompt
   */
  getIdeaRefinementPrompt(idea) {
    return `I want to refine this idea: "${idea.title}"

${idea.summary}

Excitement: ${idea.excitement}/10 | Complexity: ${idea.complexity}${idea.vibe && idea.vibe.length > 0 ? ` | Vibe: ${idea.vibe.join(', ')}` : ''}

Help me think this through!`;
  }

  /**
   * Transcribe audio using OpenAI Whisper and extract idea details via OpenRouter
   */
  async transcribeAudio(base64Audio, mimeType = 'audio/webm') {
    try {
      console.log('[AI Service] Transcribing audio with Whisper...');

      if (!this.openrouter) {
        throw new Error('OPENROUTER_API_KEY not configured');
      }

      // Step 1: Convert base64 to buffer
      const audioBuffer = Buffer.from(base64Audio, 'base64');

      // Step 2: Transcribe with Whisper via OpenRouter
      const audioFile = await toFile(audioBuffer, 'audio.webm', { type: mimeType });
      const transcriptionResponse = await this.openrouter.audio.transcriptions.create({
        file: audioFile,
        model: 'openai/whisper-1',
      });
      const transcript = transcriptionResponse.text;
      console.log('[AI Service] Whisper transcript:', transcript);

      // Step 3: Extract title, summary, and tags via OpenRouter
      console.log('[AI Service] Extracting idea details...');
      const model = process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct';

      const response = await this.openrouter.chat.completions.create({
        model,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Extract from this spoken idea: "${transcript}"

1. A short, catchy title (3-8 words)
2. A clean, grammatically correct summary
3. 3-5 relevant tags (lowercase, single words like: web, mobile, ai, backend, frontend, etc.)

Respond ONLY with valid JSON in this exact format:
{
  "title": "The extracted title",
  "summary": "The cleaned up summary",
  "tags": ["tag1", "tag2", "tag3"]
}`,
        }],
      });

      const content = response.choices[0].message.content;
      console.log('[AI Service] Extraction response:', content);

      let jsonText = content.trim();
      jsonText = jsonText.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];

      const parsed = JSON.parse(jsonText);

      return {
        transcript,
        title: parsed.title || transcript.substring(0, 50),
        summary: parsed.summary || transcript,
        tags: parsed.tags || [],
      };
    } catch (error) {
      console.error('[AI Service] Transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return {
      openrouter: {
        name: 'OpenRouter',
        available: !!this.openrouter,
        configured: !!process.env.OPENROUTER_API_KEY,
        models: [process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct'],
      },
      ollama: {
        name: 'Ollama',
        available: true,
        configured: true,
        models: ['llama2', 'mistral', 'codellama'],
      },
    };
  }

  // ── Agentic tool loop ──────────────────────────────────────────────────
  async runWithTools(messages, tools, onEvent, options = {}) {
    const { callTool } = await import('./toolService.js');
    return this._runWithToolsOpenRouter(messages, tools, callTool, onEvent, options);
  }

  async _runWithToolsOpenRouter(messages, tools, callTool, onEvent, options) {
    if (!this.openrouter) throw new Error('OPENROUTER_API_KEY not configured');

    const model = options.model || process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct';
    const systemPrompt = options.systemPrompt || '';

    const openaiTools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const history = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages,
    ];

    while (true) {
      const response = await this.openrouter.chat.completions.create({
        model,
        max_tokens: options.maxTokens || 2048,
        tools: openaiTools,
        messages: history,
      });

      const msg = response.choices[0].message;
      history.push(msg);

      if (!msg.tool_calls?.length) {
        const text = msg.content || '';
        for (const word of text.split(/(?<=\s)/)) onEvent({ type: 'token', text: word });
        onEvent({ type: 'done', content: text });
        return text;
      }

      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        onEvent({ type: 'tool_call', name: tc.function.name, args });
        const result = await callTool(tc.function.name, args);
        onEvent({ type: 'tool_result', name: tc.function.name, result });
        history.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }
  }
}

export const aiService = new AIService();

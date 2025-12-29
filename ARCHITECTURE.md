# Vibrater V2 Architecture
## From Idea Capture to Full Development Lifecycle Platform

**Version:** 2.0
**Date:** 2025-12-24
**Status:** Design Phase

---

## Table of Contents
1. [Vision & Overview](#vision--overview)
2. [System Architecture](#system-architecture)
3. [Data Model & Database Schema](#data-model--database-schema)
4. [API Specification](#api-specification)
5. [AI Provider Abstraction](#ai-provider-abstraction)
6. [Git Integration Strategy](#git-integration-strategy)
7. [Authentication & Sync](#authentication--sync)
8. [Frontend Architecture](#frontend-architecture)
9. [Migration Plan](#migration-plan)
10. [Development Roadmap](#development-roadmap)
11. [Deployment & Operations](#deployment--operations)

---

## Vision & Overview

### Current State (V1)
Vibrater is a mobile-first PWA for capturing vibe coding ideas through conversational voice/text input. All data stored in localStorage, no backend, no AI integration.

### Vision (V2)
Transform Vibrater into a complete development lifecycle platform:

**Idea → Plan → Build → Ship**

- Capture ideas conversationally (existing)
- Promote ideas to projects with task breakdowns
- AI-assisted coding companion (code generation, debugging, scaffolding)
- Progress tracking and roadmaps
- Git integration for actual code repositories
- Cloud sync across devices
- Self-hosted, not dependent on third-party platforms

### Core Principles
1. **AI-First**: Claude API primary, multi-provider support
2. **Self-Hosted**: Custom backend, no vendor lock-in
3. **Developer-Friendly**: Git native, PostgreSQL, standard tech
4. **Mobile-First**: Still great on phone, enhanced on desktop
5. **Privacy-Conscious**: Self-hostable, data ownership

---

## System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                  Vibrater PWA                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Idea Capture │  │   Projects   │  │  AI Chat     │ │
│  │   (Voice)    │  │   & Tasks    │  │  Companion   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Code Viewer  │  │   Roadmap    │  │  Git Ops     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────┬──────────────────────────────┘
                          │
                    REST API + WebSocket
                          │
┌─────────────────────────▼──────────────────────────────┐
│               Vibrater Backend API                     │
│                 (Node.js + Express)                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Authentication (JWT) + Rate Limiting            │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │  Ideas     │  │  Projects  │  │   Tasks    │      │
│  │  Routes    │  │  Routes    │  │   Routes   │      │
│  └────────────┘  └────────────┘  └────────────┘      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │  AI Chat   │  │  Git Ops   │  │   Sync     │      │
│  │  Routes    │  │  Routes    │  │   Routes   │      │
│  └────────────┘  └────────────┘  └────────────┘      │
└────┬──────────────────┬─────────────────┬─────────────┘
     │                  │                 │
     ▼                  ▼                 ▼
┌─────────┐    ┌─────────────────┐   ┌──────────┐
│PostgreSQL│    │  AI Providers   │   │   Git    │
│         │    │  ┌───────────┐  │   │  Repos   │
│ - Users │    │  │  Claude   │  │   │          │
│ - Ideas │    │  │  OpenAI   │  │   │ Project  │
│ - Projects│   │  │  Ollama   │  │   │  Code    │
│ - Tasks │    │  └───────────┘  │   │          │
│ - AIChats│    └─────────────────┘   └──────────┘
└─────────┘
```

### Technology Stack

**Frontend (PWA):**
- Vanilla JavaScript (existing) or migrate to Svelte/React later
- Web Speech API (voice input)
- Service Workers (offline support)
- IndexedDB (local cache with sync queue)
- TailwindCSS (styling)

**Backend:**
- Node.js 20+ LTS
- Express.js (REST API)
- Socket.io (real-time updates)
- Prisma ORM (database access)
- PostgreSQL 15+ (primary database)

**AI Integration:**
- Claude API (Anthropic) - Primary
- OpenAI API (fallback/alternative)
- Ollama (local LLM option)
- Provider abstraction layer

**Git Integration:**
- simple-git (Node.js git wrapper)
- Direct git commands for advanced ops
- GitHub/GitLab API integration (optional)

**Authentication:**
- JWT (access + refresh tokens)
- Bcrypt (password hashing)
- Rate limiting (express-rate-limit)

**Deployment:**
- Docker + Docker Compose
- PostgreSQL container
- Backend API container
- Nginx reverse proxy
- Self-hostable on any VPS

---

## Data Model & Database Schema

### Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  subscription VARCHAR(50) DEFAULT 'free', -- free, pro
  ai_provider VARCHAR(50) DEFAULT 'claude' -- claude, openai, ollama
);

-- User Devices (for sync tracking)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Ideas (existing concept, enhanced)
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Original capture
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  transcript TEXT, -- original voice/text input
  conversation JSONB, -- [{role, content, timestamp}]

  -- Metadata
  vibe TEXT[], -- ["trippy", "visual", "music"]
  excitement INTEGER CHECK (excitement >= 0 AND excitement <= 10),
  complexity VARCHAR(50), -- "weekend", "week", "epic"
  tech_stack TEXT[],

  -- Status
  status VARCHAR(50) DEFAULT 'idea', -- idea, promoted-to-project
  project_id UUID REFERENCES projects(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_viewed_at TIMESTAMP,

  -- Rich content
  notes TEXT,
  links TEXT[],
  tags TEXT[]
);

-- Projects (promoted ideas that are being built)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  origin_idea_id UUID REFERENCES ideas(id),

  -- Basic info
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Status & Progress
  status VARCHAR(50) DEFAULT 'planning', -- planning, in-progress, paused, completed, abandoned
  completion_percent INTEGER DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),

  -- Technical
  tech_stack TEXT[],
  vibe TEXT[],
  excitement INTEGER CHECK (excitement >= 0 AND excitement <= 10),

  -- Git integration
  repository_url VARCHAR(500),
  repository_branch VARCHAR(255) DEFAULT 'main',
  repository_local_path TEXT,
  last_git_sync_at TIMESTAMP,

  -- Timeline
  started_at TIMESTAMP,
  target_completion_date DATE,
  completed_at TIMESTAMP,

  -- Metadata
  time_spent_minutes INTEGER DEFAULT 0,
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_worked_on TIMESTAMP
);

-- Tasks (todo items for projects)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Task info
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'todo', -- todo, in-progress, done, blocked
  priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high

  -- Ordering
  sort_order INTEGER,

  -- Metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,

  -- Relations
  code_snippet_id UUID, -- reference to related code (may not be in DB)
  blocked_by_task_id UUID REFERENCES tasks(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- AI Conversations (chat history with AI coding companion)
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Conversation
  messages JSONB NOT NULL, -- [{role: "user"|"assistant", content, timestamp}]

  -- Context
  context_type VARCHAR(50), -- "debugging", "scaffolding", "ideation", "general"
  ai_provider VARCHAR(50), -- "claude", "openai", "ollama"

  -- Metadata
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Code Snippets (generated or saved code)
CREATE TABLE code_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Code info
  filename VARCHAR(500),
  language VARCHAR(100),
  code TEXT NOT NULL,

  -- Metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  generation_prompt TEXT,
  ai_conversation_id UUID REFERENCES ai_conversations(id),

  -- Git info (if committed)
  git_committed BOOLEAN DEFAULT FALSE,
  git_commit_hash VARCHAR(40),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ideas_user_id ON ideas(user_id);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_ai_conversations_project_id ON ai_conversations(project_id);
CREATE INDEX idx_code_snippets_project_id ON code_snippets(project_id);
```

### Data Relationships

```
User (1) ──< (N) Ideas
User (1) ──< (N) Projects
User (1) ──< (N) AIConversations
User (1) ──< (N) Devices

Idea (1) ──> (0..1) Project [promotion]

Project (1) ──< (N) Tasks
Project (1) ──< (N) AIConversations
Project (1) ──< (N) CodeSnippets

Task (0..1) ──> (0..1) Task [blocked_by]

AIConversation (1) ──< (N) CodeSnippets [via id reference]
```

---

## API Specification

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication

All authenticated endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

#### Auth Endpoints

```
POST /auth/register
Body: { email, password, name }
Response: { user, accessToken, refreshToken }

POST /auth/login
Body: { email, password }
Response: { user, accessToken, refreshToken }

POST /auth/refresh
Body: { refreshToken }
Response: { accessToken }

GET /auth/me
Response: { user }

POST /auth/logout
Body: { refreshToken }
Response: { success }
```

### Ideas Endpoints

```
GET /ideas
Query: ?status=idea|promoted-to-project&limit=50&offset=0
Response: { ideas: [...], total, page }

POST /ideas
Body: { title, summary, transcript, conversation, vibe, excitement, complexity, techStack }
Response: { idea }

GET /ideas/:id
Response: { idea }

PUT /ideas/:id
Body: { title?, summary?, ... }
Response: { idea }

DELETE /ideas/:id
Response: { success }

POST /ideas/:id/promote
Body: { projectTitle?, projectDescription? }
Response: { project } // Creates new project, links idea
```

### Projects Endpoints

```
GET /projects
Query: ?status=planning|in-progress|paused|completed|abandoned&limit=50&offset=0
Response: { projects: [...], total, page }

POST /projects
Body: { title, description, originIdeaId?, techStack, vibe }
Response: { project }

GET /projects/:id
Response: { project, tasks, recentAIChats }

PUT /projects/:id
Body: { title?, description?, status?, completionPercent?, ... }
Response: { project }

DELETE /projects/:id
Response: { success }

POST /projects/:id/start
Response: { project } // Sets status to in-progress, started_at timestamp

POST /projects/:id/complete
Response: { project } // Sets status to completed, completed_at timestamp
```

### Tasks Endpoints

```
GET /projects/:projectId/tasks
Query: ?status=todo|in-progress|done&priority=low|medium|high
Response: { tasks: [...] }

POST /projects/:projectId/tasks
Body: { title, description, priority, estimatedMinutes }
Response: { task }

PUT /tasks/:id
Body: { title?, description?, status?, priority?, ... }
Response: { task }

DELETE /tasks/:id
Response: { success }

POST /tasks/:id/complete
Response: { task } // Sets status to done, completed_at timestamp

POST /tasks/:id/start
Response: { task } // Sets status to in-progress
```

### AI Endpoints

```
POST /ai/chat
Body: {
  projectId?,
  message,
  conversationId?, // continue existing conversation
  provider?: "claude"|"openai"|"ollama" // override user default
}
Response: {
  conversationId,
  message: { role: "assistant", content },
  tokensUsed,
  cost
}

POST /ai/scaffold
Body: {
  projectId,
  description, // "Create a React component for user authentication"
  techStack // ["React", "TypeScript", "Tailwind"]
}
Response: {
  files: [{ filename, code, language }],
  conversationId,
  instructions // setup instructions
}

POST /ai/suggest-tasks
Body: { projectId }
Response: {
  tasks: [{ title, description, priority, estimatedMinutes }],
  reasoning // why AI suggested these
}

POST /ai/debug
Body: {
  projectId,
  error, // error message or stack trace
  code?, // code snippet causing error
  context? // additional context
}
Response: {
  analysis, // what's wrong
  solution, // how to fix
  codeChanges?: [{ filename, oldCode, newCode }],
  conversationId
}

GET /ai/providers
Response: {
  providers: [
    { name: "claude", available: true, configured: true },
    { name: "openai", available: true, configured: false },
    { name: "ollama", available: false, configured: false }
  ]
}

GET /ai/conversations/:projectId
Response: { conversations: [...] }

GET /ai/conversations/:id
Response: { conversation }
```

### Git Endpoints

```
POST /git/init
Body: { projectId, repositoryUrl?, localPath? }
Response: { repository, initialized: true }

POST /git/clone
Body: { projectId, repositoryUrl, branch? }
Response: { success, localPath }

GET /git/:projectId/status
Response: {
  branch,
  ahead, behind,
  modified: [...],
  untracked: [...],
  staged: [...]
}

POST /git/:projectId/commit
Body: { message, files? }
Response: { commitHash, message }

POST /git/:projectId/push
Response: { success, ref }

POST /git/:projectId/pull
Response: { success, changes }

GET /git/:projectId/log
Query: ?limit=20
Response: { commits: [{ hash, message, author, date }] }

GET /git/:projectId/diff
Query: ?file=path/to/file
Response: { diff }
```

### Sync Endpoints

```
GET /sync
Query: ?since=<timestamp>&deviceId=<id>
Response: {
  ideas: [...],
  projects: [...],
  tasks: [...],
  aiConversations: [...],
  lastSync: <timestamp>
}

POST /sync
Body: {
  deviceId,
  ideas: [{ id, ...data, localUpdatedAt }],
  projects: [...],
  tasks: [...],
  // Conflict resolution: server wins or last-write-wins
}
Response: {
  synced: { ideas: 5, projects: 2, tasks: 10 },
  conflicts: [...], // if any
  lastSync: <timestamp>
}
```

### Code Snippets Endpoints

```
GET /projects/:projectId/snippets
Response: { snippets: [...] }

POST /projects/:projectId/snippets
Body: { filename, language, code, aiGenerated?, generationPrompt? }
Response: { snippet }

GET /snippets/:id
Response: { snippet }

PUT /snippets/:id
Body: { code?, filename? }
Response: { snippet }

DELETE /snippets/:id
Response: { success }
```

---

## AI Provider Abstraction

### Design Goals
1. Support multiple AI providers (Claude, OpenAI, Ollama)
2. Easy to add new providers
3. Consistent interface for all providers
4. Provider-specific optimizations
5. Graceful fallback if provider unavailable
6. Cost tracking per provider

### Provider Interface

```typescript
interface AIProvider {
  name: string; // "claude", "openai", "ollama"
  isAvailable(): Promise<boolean>;
  isConfigured(): boolean;

  chat(options: ChatOptions): Promise<ChatResponse>;
  streamChat(options: ChatOptions): AsyncGenerator<StreamChunk>;

  estimateCost(tokens: number): number;
  getMaxTokens(): number;
}

interface ChatOptions {
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  stream?: boolean;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number; // in USD
  provider: string;
  model: string;
  finishReason: "stop" | "length" | "error";
}

interface StreamChunk {
  delta: string; // incremental text
  done: boolean;
}
```

### Provider Implementations

#### Claude Provider

```javascript
// src/services/ai/claude.js
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeProvider {
  constructor(apiKey) {
    this.name = 'claude';
    this.client = new Anthropic({ apiKey });
    this.model = 'claude-sonnet-4-5-20250929'; // or claude-opus-4-5
  }

  async isAvailable() {
    try {
      // Simple health check
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  isConfigured() {
    return !!this.client.apiKey;
  }

  async chat({ messages, systemPrompt, temperature = 0.7, maxTokens = 4000 }) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages
    });

    const content = response.content[0].text;
    const tokensUsed = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens
    };

    return {
      content,
      tokensUsed,
      cost: this.estimateCost(tokensUsed.total),
      provider: this.name,
      model: this.model,
      finishReason: response.stop_reason
    };
  }

  async *streamChat({ messages, systemPrompt, temperature = 0.7, maxTokens = 4000 }) {
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
      stream: true
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield {
          delta: event.delta.text,
          done: false
        };
      } else if (event.type === 'message_stop') {
        yield { delta: '', done: true };
      }
    }
  }

  estimateCost(tokens) {
    // Claude Sonnet 4.5 pricing (example, check latest)
    // Input: $3 / 1M tokens, Output: $15 / 1M tokens
    // Rough estimate assuming 50/50 split
    const avgCostPer1MTokens = 9; // average of input/output
    return (tokens / 1_000_000) * avgCostPer1MTokens;
  }

  getMaxTokens() {
    return 200000; // Claude's context window
  }
}
```

#### OpenAI Provider

```javascript
// src/services/ai/openai.js
import OpenAI from 'openai';

export class OpenAIProvider {
  constructor(apiKey) {
    this.name = 'openai';
    this.client = new OpenAI({ apiKey });
    this.model = 'gpt-4-turbo-preview'; // or gpt-4, gpt-3.5-turbo
  }

  async chat({ messages, systemPrompt, temperature = 0.7, maxTokens = 4000 }) {
    const formattedMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens
    });

    const content = response.choices[0].message.content;
    const tokensUsed = {
      input: response.usage.prompt_tokens,
      output: response.usage.completion_tokens,
      total: response.usage.total_tokens
    };

    return {
      content,
      tokensUsed,
      cost: this.estimateCost(tokensUsed.input, tokensUsed.output),
      provider: this.name,
      model: this.model,
      finishReason: response.choices[0].finish_reason
    };
  }

  estimateCost(inputTokens, outputTokens) {
    // GPT-4 Turbo pricing (example)
    const inputCostPer1M = 10; // $10 / 1M tokens
    const outputCostPer1M = 30; // $30 / 1M tokens
    return (inputTokens / 1_000_000) * inputCostPer1M +
           (outputTokens / 1_000_000) * outputCostPer1M;
  }

  // ... similar methods
}
```

#### Ollama Provider (Local)

```javascript
// src/services/ai/ollama.js
import axios from 'axios';

export class OllamaProvider {
  constructor(baseUrl = 'http://localhost:11434') {
    this.name = 'ollama';
    this.baseUrl = baseUrl;
    this.model = 'codellama'; // or llama2, mistral, etc.
  }

  async isAvailable() {
    try {
      await axios.get(`${this.baseUrl}/api/tags`);
      return true;
    } catch {
      return false;
    }
  }

  async chat({ messages, systemPrompt, temperature = 0.7 }) {
    // Ollama API format
    const prompt = this.formatMessages(messages, systemPrompt);

    const response = await axios.post(`${this.baseUrl}/api/generate`, {
      model: this.model,
      prompt,
      temperature,
      stream: false
    });

    return {
      content: response.data.response,
      tokensUsed: {
        input: 0, // Ollama doesn't always report this
        output: 0,
        total: 0
      },
      cost: 0, // Local = free
      provider: this.name,
      model: this.model,
      finishReason: 'stop'
    };
  }

  formatMessages(messages, systemPrompt) {
    let prompt = systemPrompt ? `${systemPrompt}\n\n` : '';
    for (const msg of messages) {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    }
    prompt += 'Assistant:';
    return prompt;
  }

  estimateCost() {
    return 0; // Local is free
  }

  // ... similar methods
}
```

### AI Service Manager

```javascript
// src/services/ai/index.js
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';

export class AIService {
  constructor(config) {
    this.providers = new Map();

    // Initialize providers
    if (config.claude?.apiKey) {
      this.providers.set('claude', new ClaudeProvider(config.claude.apiKey));
    }
    if (config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider(config.openai.apiKey));
    }
    if (config.ollama?.enabled) {
      this.providers.set('ollama', new OllamaProvider(config.ollama.baseUrl));
    }

    this.defaultProvider = config.defaultProvider || 'claude';
  }

  async getProvider(name) {
    const provider = this.providers.get(name || this.defaultProvider);
    if (!provider) {
      throw new Error(`Provider ${name} not configured`);
    }

    const available = await provider.isAvailable();
    if (!available) {
      throw new Error(`Provider ${name} is not available`);
    }

    return provider;
  }

  async chat(options, providerName) {
    const provider = await this.getProvider(providerName);
    return provider.chat(options);
  }

  async streamChat(options, providerName) {
    const provider = await this.getProvider(providerName);
    return provider.streamChat(options);
  }

  async listProviders() {
    const list = [];
    for (const [name, provider] of this.providers.entries()) {
      list.push({
        name,
        available: await provider.isAvailable(),
        configured: provider.isConfigured()
      });
    }
    return list;
  }
}
```

### Specialized AI Prompts

```javascript
// src/services/ai/prompts.js

export const SYSTEM_PROMPTS = {
  codeGeneration: `You are an expert software developer. Generate clean, well-documented code based on user requirements.

- Follow best practices and conventions for the specified language/framework
- Include helpful comments but avoid over-commenting obvious code
- Consider edge cases and error handling
- Prefer modern, idiomatic code
- If you need clarification, ask before generating`,

  debugging: `You are an expert debugger. Help identify and fix code issues.

- Analyze error messages and stack traces carefully
- Explain what's causing the error in simple terms
- Provide a clear, step-by-step solution
- Suggest how to prevent similar issues in the future
- If you need more context, ask specific questions`,

  scaffolding: `You are an expert at project scaffolding and architecture.

- Create well-structured project boilerplates
- Include appropriate configuration files
- Set up recommended folder structure
- Include a clear README with setup instructions
- Consider the specified tech stack and best practices`,

  taskPlanning: `You are a software project manager. Break down projects into actionable tasks.

- Create clear, specific tasks (not vague)
- Estimate complexity realistically
- Order tasks by dependencies
- Identify potential blockers
- Keep tasks small enough to complete in one session when possible`
};

export function buildCodeGenerationPrompt(description, techStack) {
  return {
    systemPrompt: SYSTEM_PROMPTS.codeGeneration,
    messages: [
      {
        role: 'user',
        content: `Generate code for: ${description}\n\nTech stack: ${techStack.join(', ')}`
      }
    ]
  };
}

export function buildDebuggingPrompt(error, code, context) {
  return {
    systemPrompt: SYSTEM_PROMPTS.debugging,
    messages: [
      {
        role: 'user',
        content: `I'm getting this error:\n\n${error}\n\n${code ? `Code:\n\`\`\`\n${code}\n\`\`\`` : ''}\n\n${context ? `Context: ${context}` : ''}`
      }
    ]
  };
}

export function buildScaffoldingPrompt(description, techStack) {
  return {
    systemPrompt: SYSTEM_PROMPTS.scaffolding,
    messages: [
      {
        role: 'user',
        content: `Create a project scaffold for: ${description}\n\nTech stack: ${techStack.join(', ')}\n\nProvide the file structure and key files with their contents.`
      }
    ]
  };
}

export function buildTaskPlanningPrompt(projectDescription, techStack) {
  return {
    systemPrompt: SYSTEM_PROMPTS.taskPlanning,
    messages: [
      {
        role: 'user',
        content: `Break down this project into tasks:\n\nProject: ${projectDescription}\n\nTech stack: ${techStack.join(', ')}\n\nProvide a list of tasks with estimated complexity (low/medium/high).`
      }
    ]
  };
}
```

---

## Git Integration Strategy

### Design Principles
1. **Real Git Repos**: Don't store code in database, use actual git repositories
2. **User Owns Code**: Projects can live anywhere (GitHub, GitLab, local)
3. **Non-Destructive**: Never force push, never delete user code
4. **Offline-Capable**: Queue git operations when offline
5. **Flexible**: Support various workflows (clone existing, init new, link existing)

### Git Workflows

#### Workflow 1: New Project from Scratch
```
1. User promotes idea to project
2. User chooses "Create new repository"
3. Backend creates local git repo in projects/{projectId}
4. AI scaffolds initial code → committed to repo
5. User optionally pushes to GitHub/GitLab remote
```

#### Workflow 2: Link Existing Repository
```
1. User promotes idea to project
2. User provides GitHub/GitLab URL
3. Backend clones repo to projects/{projectId}
4. Project linked to existing code
5. User can edit, commit, push as normal
```

#### Workflow 3: Local Development
```
1. User has project on their machine already
2. User links local path to Vibrater project
3. Vibrater monitors that directory
4. Changes detected → shown in UI
5. User can commit via Vibrater or their normal workflow
```

### Git Storage Structure

```
vibrater-backend/
├── storage/
│   ├── projects/
│   │   ├── <project-uuid-1>/
│   │   │   ├── .git/
│   │   │   ├── src/
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   ├── <project-uuid-2>/
│   │   │   └── ... (another repo)
│   │   └── ...
│   └── temp/
│       └── ... (temporary clones, etc.)
```

### Git Operations Implementation

```javascript
// src/services/git.js
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs-extra';

export class GitService {
  constructor(storageRoot = './storage/projects') {
    this.storageRoot = storageRoot;
  }

  getProjectPath(projectId) {
    return path.join(this.storageRoot, projectId);
  }

  async initRepository(projectId, initialFiles = []) {
    const projectPath = this.getProjectPath(projectId);
    await fs.ensureDir(projectPath);

    const git = simpleGit(projectPath);
    await git.init();
    await git.addConfig('user.name', 'Vibrater');
    await git.addConfig('user.email', 'vibrater@localhost');

    // Add initial files if provided
    if (initialFiles.length > 0) {
      for (const file of initialFiles) {
        const filePath = path.join(projectPath, file.filename);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content);
      }
      await git.add('.');
      await git.commit('Initial commit from Vibrater');
    }

    return { initialized: true, path: projectPath };
  }

  async cloneRepository(projectId, repoUrl, branch = 'main') {
    const projectPath = this.getProjectPath(projectId);
    await fs.ensureDir(path.dirname(projectPath));

    const git = simpleGit();
    await git.clone(repoUrl, projectPath, ['--branch', branch]);

    return { cloned: true, path: projectPath };
  }

  async linkLocalRepository(projectId, localPath) {
    // Verify it's a git repo
    const git = simpleGit(localPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Not a git repository');
    }

    // Store the link (we don't copy, just reference)
    return { linked: true, path: localPath };
  }

  async getStatus(projectId, customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    const status = await git.status();
    return {
      branch: status.current,
      ahead: status.ahead,
      behind: status.behind,
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed,
      staged: status.staged,
      conflicted: status.conflicted,
      isClean: status.isClean()
    };
  }

  async commit(projectId, message, files = null, customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }

    const result = await git.commit(message);
    return {
      commitHash: result.commit,
      message: message,
      summary: result.summary
    };
  }

  async push(projectId, remote = 'origin', branch = 'main', customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    await git.push(remote, branch);
    return { success: true, ref: `${remote}/${branch}` };
  }

  async pull(projectId, remote = 'origin', branch = 'main', customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    const result = await git.pull(remote, branch);
    return {
      success: true,
      filesChanged: result.files.length,
      insertions: result.insertions,
      deletions: result.deletions
    };
  }

  async getLog(projectId, limit = 20, customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    const log = await git.log({ maxCount: limit });
    return {
      commits: log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
        date: commit.date
      }))
    };
  }

  async getDiff(projectId, filename = null, customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    const diff = filename
      ? await git.diff(['--', filename])
      : await git.diff();

    return { diff };
  }

  async createBranch(projectId, branchName, customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    await git.checkoutLocalBranch(branchName);
    return { branch: branchName, created: true };
  }

  async checkoutBranch(projectId, branchName, customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    await git.checkout(branchName);
    return { branch: branchName };
  }

  async addRemote(projectId, remoteName, remoteUrl, customPath = null) {
    const projectPath = customPath || this.getProjectPath(projectId);
    const git = simpleGit(projectPath);

    await git.addRemote(remoteName, remoteUrl);
    return { remote: remoteName, url: remoteUrl };
  }
}
```

### AI + Git Integration

When AI generates code, it can be:
1. **Previewed** - Shown to user before committing
2. **Saved to file** - Written to project directory
3. **Auto-committed** - Committed with AI-generated message
4. **Stashed** - User decides later whether to keep

```javascript
// Example: AI scaffolding creates files and commits
async function scaffoldProject(projectId, description, techStack) {
  // 1. Generate code via AI
  const files = await aiService.scaffold({
    description,
    techStack
  });

  // 2. Initialize git repo
  await gitService.initRepository(projectId, files);

  // 3. Commit
  await gitService.commit(
    projectId,
    `Initial scaffold: ${description}\n\nGenerated by AI for tech stack: ${techStack.join(', ')}`
  );

  return { files, committed: true };
}
```

---

## Authentication & Sync

### Authentication Flow

#### Registration
```
1. User submits email + password
2. Backend validates email format
3. Password hashed with bcrypt (10 rounds)
4. User record created in database
5. JWT access token (15min expiry) + refresh token (7 day expiry) generated
6. Tokens returned to client
```

#### Login
```
1. User submits email + password
2. Backend finds user by email
3. Password verified with bcrypt
4. JWT tokens generated
5. Device registered/updated (for sync tracking)
6. Tokens returned to client
```

#### Token Refresh
```
1. Client access token expires
2. Client sends refresh token to /auth/refresh
3. Backend validates refresh token
4. New access token generated
5. Optionally rotate refresh token
6. New token(s) returned
```

#### Logout
```
1. Client sends refresh token to /auth/logout
2. Backend invalidates refresh token (add to blacklist or delete from DB)
3. Client deletes local tokens
```

### JWT Payload

```javascript
// Access Token (short-lived, 15 min)
{
  userId: "uuid",
  email: "user@example.com",
  type: "access",
  iat: 1234567890,
  exp: 1234568790 // 15 min later
}

// Refresh Token (long-lived, 7 days)
{
  userId: "uuid",
  deviceId: "uuid",
  type: "refresh",
  iat: 1234567890,
  exp: 1235172690 // 7 days later
}
```

### Multi-Device Sync Strategy

#### Sync Architecture
- **Client**: PWA with IndexedDB cache
- **Server**: PostgreSQL source of truth
- **Conflict Resolution**: Last-write-wins (for MVP, can enhance later)
- **Sync Frequency**: On app open, on background interval (5 min), on user action

#### Data Flow

```
┌─────────────┐                    ┌─────────────┐
│   Phone     │                    │   Laptop    │
│             │                    │             │
│ IndexedDB   │                    │ IndexedDB   │
│  (cache)    │                    │  (cache)    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ POST /sync                      │ POST /sync
       │ (push changes)                  │ (push changes)
       │                                  │
       ▼                                  ▼
┌──────────────────────────────────────────────┐
│            Backend API                       │
│                                              │
│  Merge changes, detect conflicts            │
│  (Last-write-wins based on updated_at)      │
│                                              │
└──────────────┬───────────────────────────────┘
               │
               ▼
       ┌───────────────┐
       │  PostgreSQL   │
       │ (source of    │
       │    truth)     │
       └───────────────┘
```

#### Sync Endpoint Logic

```javascript
// POST /sync endpoint
async function syncData(req, res) {
  const { userId, deviceId, ideas = [], projects = [], tasks = [] } = req.body;
  const { since } = req.query; // Last sync timestamp

  // 1. Pull server changes since last sync
  const serverIdeas = await db.ideas.findMany({
    where: { userId, updatedAt: { gt: since } }
  });
  const serverProjects = await db.projects.findMany({
    where: { userId, updatedAt: { gt: since } }
  });
  const serverTasks = await db.tasks.findMany({
    where: {
      project: { userId },
      updatedAt: { gt: since }
    }
  });

  // 2. Push client changes to server
  const conflicts = [];

  for (const idea of ideas) {
    const existing = await db.ideas.findUnique({ where: { id: idea.id } });

    if (!existing) {
      // New idea from client
      await db.ideas.create({ data: idea });
    } else if (existing.updatedAt > idea.localUpdatedAt) {
      // Server version is newer - conflict!
      conflicts.push({
        type: 'idea',
        id: idea.id,
        clientVersion: idea,
        serverVersion: existing
      });
    } else {
      // Client version is newer - update
      await db.ideas.update({
        where: { id: idea.id },
        data: idea
      });
    }
  }

  // Similar logic for projects and tasks...

  // 3. Update device last sync timestamp
  await db.devices.update({
    where: { userId, deviceId },
    data: { lastSyncAt: new Date() }
  });

  // 4. Return merged data to client
  return res.json({
    synced: {
      ideas: ideas.length,
      projects: projects.length,
      tasks: tasks.length
    },
    serverData: {
      ideas: serverIdeas,
      projects: serverProjects,
      tasks: serverTasks
    },
    conflicts,
    lastSync: new Date().toISOString()
  });
}
```

#### Conflict Resolution

For MVP: **Last-write-wins** (based on `updated_at` timestamp)

Future enhancements:
- Field-level merging (merge non-conflicting fields)
- User-prompted resolution (show both versions, let user choose)
- Operational transformation (CRDT-style)

---

## Frontend Architecture

### Current State (V1)
- Single `app.js` file (~500 lines)
- Class-based architecture (`Vibrater` class)
- localStorage for persistence
- Voice input with Web Speech API
- Conversational UI for idea capture

### Enhancements for V2

#### Option A: Enhance Existing (Minimal Refactor)
Keep vanilla JS, refactor into modules:

```
vibrater/
├── index.html
├── manifest.json
├── sw.js
├── style.css
├── js/
│   ├── main.js              # App initialization
│   ├── auth.js              # Login/register/JWT handling
│   ├── api.js               # Backend API client
│   ├── sync.js              # Sync engine
│   ├── storage.js           # IndexedDB wrapper
│   ├── views/
│   │   ├── ideas.js         # Idea capture view (existing)
│   │   ├── projects.js      # Project list/detail view
│   │   ├── tasks.js         # Task management view
│   │   ├── ai-chat.js       # AI chat interface
│   │   └── code-viewer.js   # Code snippet viewer
│   └── components/
│       ├── voice-input.js   # Voice button component
│       ├── task-list.js     # Task list component
│       └── progress-bar.js  # Progress indicator
```

#### Option B: Migrate to Framework (Better Scalability)
Migrate to Svelte or React for better state management:

**Svelte** (Recommended for PWA):
- Smaller bundle size
- Reactive by default
- Compiles to vanilla JS
- Great for mobile performance

**React** (More ecosystem):
- Larger community
- More libraries available
- More developers familiar with it

### Key Frontend Components Needed

#### 1. Auth Screen
```javascript
// Login/Register form
// JWT token storage
// Auto-refresh token logic
```

#### 2. Projects Dashboard
```javascript
// List of projects with status
// Progress indicators
// Filter/sort options
// Quick actions (open, archive, delete)
```

#### 3. Project Detail View
```javascript
// Project info
// Task list (with checkboxes)
// AI chat button
// Git status widget
// Code snippets section
```

#### 4. AI Chat Interface
```javascript
// Chat messages (user + AI)
// Voice/text input
// Streaming responses
// Code block rendering with syntax highlighting
// Quick actions (save as snippet, create task, scaffold)
```

#### 5. Code Viewer
```javascript
// File tree navigation
// Syntax-highlighted code view
// Diff viewer
// Edit capability (basic)
```

#### 6. Sync Status Indicator
```javascript
// Show last sync time
// Sync in progress indicator
// Offline mode indicator
// Manual sync button
```

### State Management

#### LocalFirst Architecture
```javascript
// All data stored in IndexedDB
// Background sync to server
// Optimistic updates (update UI immediately, sync later)
// Sync queue for offline operations

class SyncEngine {
  constructor() {
    this.db = new IndexedDBWrapper();
    this.queue = [];
    this.isSyncing = false;
  }

  async queueOperation(type, entity, data) {
    // Add to queue
    this.queue.push({ type, entity, data, timestamp: Date.now() });
    await this.db.saveQueue(this.queue);

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.sync();
    }
  }

  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // Send queued operations to server
      const response = await api.post('/sync', {
        deviceId: this.deviceId,
        operations: this.queue
      });

      // Clear queue on success
      this.queue = [];
      await this.db.saveQueue([]);

      // Update local cache with server data
      await this.db.mergeServerData(response.serverData);

      // Handle conflicts
      if (response.conflicts.length > 0) {
        this.handleConflicts(response.conflicts);
      }

      this.emit('synced', response);
    } catch (error) {
      console.error('Sync failed:', error);
      this.emit('sync-error', error);
    } finally {
      this.isSyncing = false;
    }
  }

  handleConflicts(conflicts) {
    // For now: server wins
    // Future: prompt user
    console.warn('Conflicts detected:', conflicts);
  }
}
```

### Routing

For vanilla JS:
```javascript
// Simple hash-based routing
class Router {
  constructor(routes) {
    this.routes = routes;
    window.addEventListener('hashchange', () => this.route());
    this.route(); // Initial route
  }

  route() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, ...params] = hash.split('/');
    const handler = this.routes[path] || this.routes['404'];
    handler(...params);
  }
}

// Usage
const router = new Router({
  '/': showDashboard,
  'ideas': showIdeas,
  'projects': showProjects,
  'project': showProjectDetail, // /project/:id
  'ai': showAIChat,
  '404': show404
});
```

---

## Migration Plan

### Phase 1: Backend Setup (Week 1)
**Goal:** Working backend API with database

Tasks:
- [ ] Set up Node.js + Express project
- [ ] Configure PostgreSQL database
- [ ] Create database schema (migrations)
- [ ] Implement authentication (register, login, JWT)
- [ ] Build Ideas CRUD endpoints
- [ ] Build Projects CRUD endpoints
- [ ] Build Tasks CRUD endpoints
- [ ] Set up Docker Compose for local development
- [ ] Write API documentation

**Deliverable:** Backend API running locally, all endpoints tested

### Phase 2: AI Integration (Week 2)
**Goal:** AI provider abstraction working

Tasks:
- [ ] Implement Claude API provider
- [ ] Implement OpenAI API provider
- [ ] Implement Ollama provider (optional)
- [ ] Build AI service abstraction layer
- [ ] Create AI endpoints (/chat, /scaffold, /debug, /suggest-tasks)
- [ ] Write system prompts for each use case
- [ ] Test AI responses for quality
- [ ] Add cost tracking

**Deliverable:** AI chat working via API

### Phase 3: Git Integration (Week 3)
**Goal:** Git operations working

Tasks:
- [ ] Set up git storage structure
- [ ] Implement GitService class
- [ ] Build git endpoints (init, clone, commit, push, pull, status, diff)
- [ ] Test various git workflows
- [ ] Handle error cases (conflicts, authentication)
- [ ] Add SSH key management for private repos

**Deliverable:** Can create repos, commit, push via API

### Phase 4: Frontend Updates (Week 4)
**Goal:** Frontend supports new features

Tasks:
- [ ] Add authentication UI (login/register)
- [ ] Implement token storage and refresh
- [ ] Build project list view
- [ ] Build project detail view
- [ ] Build task management UI
- [ ] Build AI chat interface
- [ ] Add code viewer component
- [ ] Implement IndexedDB storage
- [ ] Build sync engine

**Deliverable:** Full UI for all features

### Phase 5: Sync & Polish (Week 5)
**Goal:** Multi-device sync working

Tasks:
- [ ] Implement sync logic (client + server)
- [ ] Handle conflict resolution
- [ ] Add offline support
- [ ] Test sync across devices
- [ ] Add loading states and error handling
- [ ] Improve UI/UX polish
- [ ] Add keyboard shortcuts
- [ ] Optimize performance

**Deliverable:** Can sync between phone and laptop

### Phase 6: Deployment (Week 6)
**Goal:** Production-ready deployment

Tasks:
- [ ] Write deployment documentation
- [ ] Create production Docker setup
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL certificates
- [ ] Configure environment variables
- [ ] Set up database backups
- [ ] Add monitoring/logging
- [ ] Deploy to VPS (DigitalOcean, Hetzner, etc.)
- [ ] Test production deployment

**Deliverable:** Running in production, accessible from anywhere

---

## Development Roadmap

### MVP (V2.0) - 6 Weeks
**Core Features:**
- ✅ Idea capture (existing)
- ✅ Promote ideas to projects
- ✅ Task management (todo lists)
- ✅ AI chat for code generation/debugging
- ✅ Git repository integration
- ✅ Multi-device sync
- ✅ Self-hosted backend

**Out of Scope:**
- Advanced conflict resolution
- Collaboration/sharing
- GitHub issues integration
- In-app code editing
- Build/deploy automation

### V2.1 - Future Enhancements
- Improved conflict resolution (user-prompted)
- Code editor integration (VS Code extension)
- GitHub/GitLab OAuth + issues sync
- Roadmap visualization (Gantt chart)
- Time tracking and analytics
- Export to various formats (CSV, JSON)
- Mobile app (React Native)

### V2.2 - Collaboration
- Share projects with team
- Assign tasks to users
- Real-time collaboration
- Comments and discussions
- Activity feed

### V3.0 - Build & Deploy
- In-app terminal
- Build automation
- Deploy to Vercel/Netlify/Railway from UI
- CI/CD integration
- Environment management

---

## Deployment & Operations

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: vibrater
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: vibrater
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  backend:
    build: ./vibrater-backend
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://vibrater:${DB_PASSWORD}@postgres:5432/vibrater
      JWT_SECRET: ${JWT_SECRET}
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL}
    volumes:
      - ./storage:/app/storage
      - ./logs:/app/logs
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./vibrater:/usr/share/nginx/html
      - ./ssl:/etc/nginx/ssl
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

### Environment Variables

```bash
# .env.example
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://vibrater:password@localhost:5432/vibrater

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# AI Providers
CLAUDE_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
OLLAMA_BASE_URL=http://localhost:11434

# Default AI Provider
DEFAULT_AI_PROVIDER=claude

# Storage
STORAGE_ROOT=./storage/projects

# CORS
CORS_ORIGIN=https://vibrater.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Nginx Configuration

```nginx
# nginx.conf
events {
  worker_connections 1024;
}

http {
  upstream backend {
    server backend:3000;
  }

  # HTTP -> HTTPS redirect
  server {
    listen 80;
    server_name vibrater.yourdomain.com;
    return 301 https://$server_name$request_uri;
  }

  # HTTPS
  server {
    listen 443 ssl http2;
    server_name vibrater.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Frontend (PWA)
    location / {
      root /usr/share/nginx/html;
      try_files $uri $uri/ /index.html;

      # PWA caching headers
      add_header Cache-Control "no-cache, must-revalidate";
    }

    # Backend API
    location /api/ {
      proxy_pass http://backend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for real-time sync
    location /ws {
      proxy_pass http://backend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
```

### Database Backups

```bash
# backup.sh
#!/bin/bash
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/vibrater_$TIMESTAMP.sql"

# Backup database
docker exec vibrater_postgres pg_dump -U vibrater vibrater > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -name "vibrater_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### Monitoring

**Recommended Tools:**
- **Uptime**: UptimeRobot (free)
- **Logs**: Journald + Loki (self-hosted) or Papertrail (cloud)
- **Metrics**: Prometheus + Grafana (self-hosted)
- **Error Tracking**: Sentry (free tier)

---

## Next Steps

### Immediate Actions
1. **Review this architecture document** - Confirm the design aligns with vision
2. **Answer open questions:**
   - Preferred frontend framework (vanilla JS, Svelte, React)?
   - Deploy on own VPS or use managed services?
   - Budget for AI API costs?
   - Target timeline?
3. **Set up development environment:**
   - Clone repo
   - Create `vibrater-backend` directory
   - Install Docker
   - Set up PostgreSQL
4. **Start Phase 1: Backend Setup**

### Open Questions for Discussion
1. Should we migrate frontend to Svelte/React or enhance vanilla JS?
2. Do you want to run Ollama locally for free AI, or primarily use Claude API?
3. What's your preferred VPS provider? (Hetzner, DigitalOcean, Linode, etc.)
4. Do you want to support GitHub OAuth login, or just email/password?
5. Should we add analytics (usage tracking, feature adoption)?

---

## Conclusion

This architecture provides a solid foundation for transforming Vibrater from a simple idea capture tool into a full development lifecycle platform. The system is designed to be:

- **Scalable**: Can grow from MVP to full-featured platform
- **Self-hosted**: No vendor lock-in, full control
- **Developer-friendly**: Uses standard tools (PostgreSQL, Git, Node.js)
- **AI-powered**: Multi-provider support with Claude as primary
- **Mobile-first**: Great UX on phone and desktop

The 6-week roadmap is aggressive but achievable for a solo developer with focus. Each phase builds on the previous, with clear deliverables.

**Ready to start building? Let's ship this thing! 🚀**

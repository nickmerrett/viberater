-- viberater Database Schema
-- Migration 001: Initial Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  subscription VARCHAR(50) DEFAULT 'free',
  ai_provider VARCHAR(50) DEFAULT 'claude'
);

-- User devices (for sync tracking)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Ideas
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Original capture
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  transcript TEXT,
  conversation JSONB,

  -- Metadata
  vibe TEXT[],
  excitement INTEGER CHECK (excitement >= 0 AND excitement <= 10),
  complexity VARCHAR(50),
  tech_stack TEXT[],

  -- Status
  status VARCHAR(50) DEFAULT 'idea',
  project_id UUID,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_viewed_at TIMESTAMP,

  -- Rich content
  notes TEXT,
  links TEXT[],
  tags TEXT[]
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  origin_idea_id UUID REFERENCES ideas(id),

  -- Basic info
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Status & Progress
  status VARCHAR(50) DEFAULT 'planning',
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

-- Add foreign key after projects table is created
ALTER TABLE ideas ADD CONSTRAINT fk_ideas_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Task info
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'todo',
  priority VARCHAR(50) DEFAULT 'medium',

  -- Ordering
  sort_order INTEGER,

  -- Metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,

  -- Relations
  code_snippet_id UUID,
  blocked_by_task_id UUID REFERENCES tasks(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Conversation
  messages JSONB NOT NULL,

  -- Context
  context_type VARCHAR(50),
  ai_provider VARCHAR(50),

  -- Metadata
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Code Snippets
CREATE TABLE IF NOT EXISTS code_snippets (
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

  -- Git info
  git_committed BOOLEAN DEFAULT FALSE,
  git_commit_hash VARCHAR(40),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens (for JWT refresh)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ideas_user_id ON ideas(user_id);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_created_at ON ideas(created_at DESC);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_sort_order ON tasks(sort_order);

CREATE INDEX idx_ai_conversations_project_id ON ai_conversations(project_id);
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);

CREATE INDEX idx_code_snippets_project_id ON code_snippets(project_id);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ideas_updated_at BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_snippets_updated_at BEFORE UPDATE ON code_snippets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

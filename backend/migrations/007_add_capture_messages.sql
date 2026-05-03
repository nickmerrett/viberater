-- Migration 007: Persistent capture conversation thread

CREATE TABLE IF NOT EXISTS capture_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_capture_messages_user_id ON capture_messages(user_id);
CREATE INDEX idx_capture_messages_created_at ON capture_messages(created_at);

-- Link ideas back to the conversation message that spawned them
ALTER TABLE ideas ADD COLUMN capture_message_id TEXT REFERENCES capture_messages(id) ON DELETE SET NULL;

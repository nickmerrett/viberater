CREATE TABLE IF NOT EXISTS attachments (
  id VARCHAR(36) PRIMARY KEY,
  idea_id VARCHAR(36) NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('image', 'link')),
  url TEXT NOT NULL,
  filename VARCHAR(255),
  size INTEGER,
  mime_type VARCHAR(100),
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_idea_id ON attachments(idea_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);

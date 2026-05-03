ALTER TABLE ideas ADD COLUMN share_token VARCHAR(36);
ALTER TABLE ideas ADD COLUMN sharing_enabled INTEGER DEFAULT 0;
ALTER TABLE ideas ADD COLUMN unread_comment_count INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ideas_share_token ON ideas(share_token);

CREATE TABLE IF NOT EXISTS idea_comments (
  id VARCHAR(36) PRIMARY KEY,
  idea_id VARCHAR(36) NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  author_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  ip_hash VARCHAR(64),
  is_author_reply INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idea_comments_idea_id ON idea_comments(idea_id);

CREATE TABLE IF NOT EXISTS idea_reactions (
  id VARCHAR(36) PRIMARY KEY,
  idea_id VARCHAR(36) NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  reaction VARCHAR(20) NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idea_reactions_idea_id ON idea_reactions(idea_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_idea_reactions_unique ON idea_reactions(idea_id, reaction, ip_hash);

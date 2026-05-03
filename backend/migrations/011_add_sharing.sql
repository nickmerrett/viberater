-- Share token on ideas
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS share_token VARCHAR(36) UNIQUE;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS sharing_enabled INTEGER DEFAULT 0;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS unread_comment_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ideas_share_token ON ideas(share_token);

-- Public comments on shared ideas
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

-- Reactions (one per emoji per IP per idea)
CREATE TABLE IF NOT EXISTS idea_reactions (
  id VARCHAR(36) PRIMARY KEY,
  idea_id VARCHAR(36) NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  reaction VARCHAR(20) NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(idea_id, reaction, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_idea_reactions_idea_id ON idea_reactions(idea_id);

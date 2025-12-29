-- Migration 003: Add archived field to ideas table
-- For retiring/archiving ideas

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ideas_archived ON ideas(archived);

COMMENT ON COLUMN ideas.archived IS 'Whether the idea has been archived/retired';

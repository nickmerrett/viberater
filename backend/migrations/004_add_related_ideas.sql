-- Migration 004: Add related_ideas to track idea relationships
-- For linking ideas together (variations, related concepts, etc.)

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS related_ideas UUID[];
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS parent_idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ideas_parent_idea ON ideas(parent_idea_id);
CREATE INDEX IF NOT EXISTS idx_ideas_related ON ideas USING GIN(related_ideas);

COMMENT ON COLUMN ideas.related_ideas IS 'Array of UUIDs of related ideas';
COMMENT ON COLUMN ideas.parent_idea_id IS 'ID of parent idea if this was created from ideation/exploration';

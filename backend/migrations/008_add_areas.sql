-- Migration 008: Areas - user-defined context classification

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_areas_user_id ON areas(user_id);

-- Add area_id to content tables
ALTER TABLE ideas ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE reminders ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL;

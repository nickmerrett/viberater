-- Migration 005: Add Project Plan Support
-- Adds fields to support AI-generated project plans

-- Add project_plan JSONB column to store structured plan data
-- This will contain: goals, phases, estimatedDuration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_plan JSONB DEFAULT '{}';

-- Add github_url as an alias for repository_url (for consistency with frontend)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_url VARCHAR(500);

-- Update existing projects to copy repository_url to github_url
UPDATE projects SET github_url = repository_url WHERE repository_url IS NOT NULL;

-- Comment to document the project_plan structure
COMMENT ON COLUMN projects.project_plan IS 'AI-generated project plan containing goals, phases, and estimated duration';

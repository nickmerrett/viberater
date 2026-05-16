-- Migration 014: Add API key support for programmatic access
ALTER TABLE users ADD COLUMN api_key_hash TEXT;
CREATE UNIQUE INDEX idx_users_api_key_hash ON users(api_key_hash) WHERE api_key_hash IS NOT NULL;

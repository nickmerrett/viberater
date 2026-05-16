-- Migration 014: Add API key support for programmatic access
ALTER TABLE users ADD COLUMN api_key_hash TEXT UNIQUE;

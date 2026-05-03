-- Purge all existing refresh tokens; they are now stored as SHA-256 hashes
-- and old plaintext JWT tokens are no longer valid after this migration.
-- Users will be prompted to log in once.
DELETE FROM refresh_tokens;

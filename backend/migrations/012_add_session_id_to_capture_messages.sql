-- Migration 012: Add session_id to capture_messages for finite chat threads

ALTER TABLE capture_messages ADD COLUMN session_id TEXT;

CREATE INDEX idx_capture_messages_session_id ON capture_messages(session_id);

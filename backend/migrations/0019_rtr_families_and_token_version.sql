-- Add familyId, rotatedFrom to refresh_tokens; tokenVersion to users
-- Migration for Refresh Token Rotation (RTR) family tracking + instant access token revocation

-- 1. Add familyId and rotatedFrom to refresh_tokens
ALTER TABLE refresh_tokens
  ADD COLUMN family_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN rotated_from uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL;

-- Backfill existing tokens: each existing token gets its own family
UPDATE refresh_tokens SET family_id = gen_random_uuid() WHERE family_id IS NULL;

-- Make family_id NOT NULL (already has values from backfill)
ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;

-- Index for fast family revocation
CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_rotated_from_idx ON refresh_tokens (rotated_from);

-- 2. Add tokenVersion to users for instant access token revocation
ALTER TABLE users
  ADD COLUMN token_version integer NOT NULL DEFAULT 0;

-- Index for fast revocation check (optional, but useful)
CREATE INDEX IF NOT EXISTS users_token_version_idx ON users (token_version);
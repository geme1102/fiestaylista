-- Migration 0022: Add token family tracking and user token version for secure RTR
-- Adds familyId + rotatedFrom to refresh_tokens for granular revocation
-- Adds tokenVersion to users for instant access-token revocation on logout/password-change

-- 1. Add familyId and rotatedFrom to refresh_tokens
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS family_id uuid,
  ADD COLUMN IF NOT EXISTS rotated_from uuid;

-- Create index for efficient family-based revocation
CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_rotated_from_idx ON refresh_tokens (rotated_from);

-- Add foreign key from rotated_from to same table (id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'refresh_tokens_rotated_from_fkey'
  ) THEN
    ALTER TABLE refresh_tokens
      ADD CONSTRAINT refresh_tokens_rotated_from_fkey
      FOREIGN KEY (rotated_from) REFERENCES refresh_tokens(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add token_version to users for instant access-token revocation
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- Create index for token_version lookups
CREATE INDEX IF NOT EXISTS users_token_version_idx ON users (token_version);

-- 3. Backfill existing refresh_tokens: assign a family_id per user (all existing tokens of a user = one family)
-- This ensures legacy tokens can still be tracked as a single family
UPDATE refresh_tokens rt
SET family_id = (
  SELECT gen_random_uuid()
  FROM users u
  WHERE u.id = rt.user_id
  LIMIT 1
)
WHERE rt.family_id IS NULL;

-- 4. Ensure token_version is already 0 for all users (DEFAULT handles new rows)
UPDATE users SET token_version = 0 WHERE token_version IS NULL;

-- 5. Add comment for documentation
COMMENT ON COLUMN refresh_tokens.family_id IS 'Groups tokens into rotation families; revocation targets entire family on reuse detection';
COMMENT ON COLUMN refresh_tokens.rotated_from IS 'FK to parent token in same family; enables chain reconstruction and granular family revocation';
COMMENT ON COLUMN users.token_version IS 'Incremented on logout/password-change/revoke-all; access tokens with older iat are rejected';
-- Add frozen_at column to events table for freeze/purge lifecycle
ALTER TABLE events ADD COLUMN frozen_at TIMESTAMPTZ;

-- Add CHECK constraint to prevent invalid tier values
ALTER TABLE users ADD CONSTRAINT users_tier_check CHECK (tier IN ('free', 'pro', 'pro_plus'));

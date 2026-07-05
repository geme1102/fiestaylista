-- Add frozen_at column to events table for freeze/purge lifecycle
ALTER TABLE events ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- Add CHECK constraint to prevent invalid tier values (skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tier_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_tier_check CHECK (tier IN ('free'::text, 'pro'::text, 'pro_plus'::text));
  END IF;
END $$;

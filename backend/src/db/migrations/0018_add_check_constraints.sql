-- Add CHECK constraints for subscriptions and users tier/status columns

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check'
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
      CHECK (status IN ('active', 'canceled', 'past_due', 'pending_approval', 'expired', 'incomplete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tier_check'
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
      CHECK (tier IN ('free', 'pro', 'pro_plus'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tier_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_tier_check
      CHECK (tier IN ('free', 'pro', 'pro_plus'));
  END IF;
END $$;

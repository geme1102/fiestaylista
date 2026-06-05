-- Add missing indexes defined in schema but not created in initial migration
CREATE INDEX IF NOT EXISTS "photos_event_id_idx" ON "photos" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_fees_contribution_id_idx" ON "platform_fees" USING btree ("contribution_id");--> statement-breakpoint

-- Trigger to keep users.tier in sync with subscriptions.tier (safety net for app-level sync)
CREATE OR REPLACE FUNCTION sync_user_tier()
RETURNS trigger AS $$
BEGIN
  UPDATE "users"
  SET "tier" = NEW.tier, "updated_at" = NOW()
  WHERE "id" = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER trg_sync_subscription_tier
AFTER INSERT OR UPDATE ON "subscriptions"
FOR EACH ROW
EXECUTE FUNCTION sync_user_tier();

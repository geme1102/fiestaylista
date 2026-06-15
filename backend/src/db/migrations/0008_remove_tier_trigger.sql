-- Remove sync_user_tier trigger (redundant — app logic already handles users.tier updates)
DROP TRIGGER IF EXISTS trg_sync_subscription_tier ON subscriptions;--> statement-breakpoint
DROP FUNCTION IF EXISTS sync_user_tier;

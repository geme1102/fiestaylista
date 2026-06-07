-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "events_user_id_deleted_at_idx" ON "events" USING btree ("user_id", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifts_event_id_deleted_at_idx" ON "gifts" USING btree ("event_id", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifts_event_id_unclaimed_idx" ON "gifts" USING btree ("event_id") WHERE "is_claimed" = false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_views_event_id_viewed_at_idx" ON "event_views" USING btree ("event_id", "viewed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_status_period_end_idx" ON "subscriptions" USING btree ("status", "current_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint

-- Unique constraint to prevent duplicate email tracking records
CREATE UNIQUE INDEX IF NOT EXISTS "email_tracking_user_id_type_unique_idx" ON "email_tracking" USING btree ("user_id", "type");--> statement-breakpoint

-- Index for email sequence queries
CREATE INDEX IF NOT EXISTS "email_tracking_sent_at_idx" ON "email_tracking" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at_email_verified_idx" ON "users" USING btree ("created_at", "email_verified");--> statement-breakpoint

-- Index for cash fund queries
CREATE INDEX IF NOT EXISTS "cash_contributions_status_created_at_idx" ON "cash_contributions" USING btree ("status", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_funds_event_id_idx" ON "cash_funds" USING btree ("event_id");--> statement-breakpoint

-- Index for event slug lookups (public page)
CREATE INDEX IF NOT EXISTS "events_slug_active_idx" ON "events" USING btree ("slug", "is_active") WHERE "deleted_at" IS NULL;

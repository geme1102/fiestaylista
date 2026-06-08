-- Index for refresh token expiration cleanup queries
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint

-- Composite index for finding active tokens per user (used in logout/revocation)
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_revoked_idx" ON "refresh_tokens" USING btree ("user_id", "revoked");--> statement-breakpoint

-- Index for failed webhook retry queries
CREATE INDEX IF NOT EXISTS "failed_webhooks_next_retry_at_idx" ON "failed_webhooks" USING btree ("next_retry_at");--> statement-breakpoint

-- Index for failed webhook resource dedup
CREATE INDEX IF NOT EXISTS "failed_webhooks_resource_id_idx" ON "failed_webhooks" USING btree ("resource_id");

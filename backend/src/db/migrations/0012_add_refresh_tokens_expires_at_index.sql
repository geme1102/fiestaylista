-- Migration 0012: Add index on refreshTokens.expiresAt for cron cleanup queries

CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens" ("expires_at");
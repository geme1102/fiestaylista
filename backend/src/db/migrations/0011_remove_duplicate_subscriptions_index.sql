-- Migration 0011: Remove duplicate index on subscriptions(status, current_period_end)
-- Index created in 0002: subscriptions_status_period_end_idx
-- Index created in 0009: subscriptions_status_current_period_end_idx
-- Both cover the same columns — drop the one from 0002 (older naming convention)

DROP INDEX IF EXISTS "subscriptions_status_period_end_idx";
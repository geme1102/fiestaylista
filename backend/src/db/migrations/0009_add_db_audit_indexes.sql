-- H1+H2: Composite index on subscriptions (status, currentPeriodEnd) for cron queries
CREATE INDEX IF NOT EXISTS subscriptions_status_current_period_end_idx ON subscriptions (status, current_period_end);--> statement-breakpoint

-- H3: Standalone index on events (deletedAt) for global count queries
CREATE INDEX IF NOT EXISTS events_deleted_at_idx ON events (deleted_at);--> statement-breakpoint

-- H4: Composite index on events (user_id, is_active, deleted_at) for deactivateExcessEvents
CREATE INDEX IF NOT EXISTS events_user_id_is_active_deleted_at_idx ON events (user_id, is_active, deleted_at);--> statement-breakpoint

-- M1: Composite index on email_tracking (user_id, type, sent_at) for NOT EXISTS subquery
CREATE INDEX IF NOT EXISTS email_tracking_user_id_type_sent_at_idx ON email_tracking (user_id, type, sent_at);

-- Convert all timestamp without time zone → timestamp with time zone
-- This ensures consistent UTC storage and avoids timezone-related bugs
-- when JS new Date() interacts with database NOW().
-- Each ALTER COLUMN uses AT TIME ZONE 'UTC' so existing values interpreted
-- as UTC regardless of the session timezone.

-- users
ALTER TABLE users ALTER COLUMN last_sequence_check TYPE TIMESTAMPTZ USING last_sequence_check AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN verification_token_expires TYPE TIMESTAMPTZ USING verification_token_expires AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN reset_token_expires TYPE TIMESTAMPTZ USING reset_token_expires AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- events
ALTER TABLE events ALTER COLUMN boosted_until TYPE TIMESTAMPTZ USING boosted_until AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN event_date TYPE TIMESTAMPTZ USING event_date AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- gifts
ALTER TABLE gifts ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
ALTER TABLE gifts ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- gift_claims
ALTER TABLE gift_claims ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- photos
ALTER TABLE photos ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE photos ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';

-- subscriptions
ALTER TABLE subscriptions ALTER COLUMN current_period_start TYPE TIMESTAMPTZ USING current_period_start AT TIME ZONE 'UTC';
ALTER TABLE subscriptions ALTER COLUMN current_period_end TYPE TIMESTAMPTZ USING current_period_end AT TIME ZONE 'UTC';
ALTER TABLE subscriptions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE subscriptions ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- cash_funds
ALTER TABLE cash_funds ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE cash_funds ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- cash_contributions
ALTER TABLE cash_contributions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- boost_payments
ALTER TABLE boost_payments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- pro_payments
ALTER TABLE pro_payments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- failed_webhooks
ALTER TABLE failed_webhooks ALTER COLUMN last_attempt_at TYPE TIMESTAMPTZ USING last_attempt_at AT TIME ZONE 'UTC';
ALTER TABLE failed_webhooks ALTER COLUMN next_retry_at TYPE TIMESTAMPTZ USING next_retry_at AT TIME ZONE 'UTC';
ALTER TABLE failed_webhooks ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- platform_fees
ALTER TABLE platform_fees ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- messages
ALTER TABLE messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- guests
ALTER TABLE guests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- email_tracking
ALTER TABLE email_tracking ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC';

-- event_views
ALTER TABLE event_views ALTER COLUMN viewed_at TYPE TIMESTAMPTZ USING viewed_at AT TIME ZONE 'UTC';

-- refresh_tokens
ALTER TABLE refresh_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';
ALTER TABLE refresh_tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- consent_records
ALTER TABLE consent_records ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- arco_requests
ALTER TABLE arco_requests ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';
ALTER TABLE arco_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- audit_logs
ALTER TABLE audit_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

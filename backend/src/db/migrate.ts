import { sql } from './index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Migrations');

// Mapeo explícito: cada migración tiene un nombre estable y una o más sentencias SQL.
// Los nombres DEBEN coincidir con los ya registrados en la tabla migration_journal
// de producción para mantener retrocompatibilidad.
interface MigrationEntry {
  name: string;
  statements: string[];
}

const COLUMN_MIGRATIONS: MigrationEntry[] = [
  {
    name: 'photos_deleted_at',
    statements: [
      `ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp`,
    ],
  },
  {
    name: 'guests_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "guests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "email" text,
        "phone" text,
        "is_confirmed" boolean NOT NULL DEFAULT false,
        "companions" integer NOT NULL DEFAULT 0,
        "dietary_restrictions" text,
        "message" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "guests_event_id_idx" ON "guests"("event_id")`,
      `CREATE INDEX IF NOT EXISTS "guests_event_id_confirmed_idx" ON "guests"("event_id", "is_confirmed")`,
    ],
  },
  {
    name: 'cash_funds_bank_fields',
    statements: [
      `ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_phone" text`,
      `ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_type" text`,
    ],
  },
  {
    name: 'gifts_is_group_gift',
    statements: [
      `ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "is_group_gift" boolean NOT NULL DEFAULT false`,
    ],
  },
  {
    name: 'gift_claims_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "gift_claims" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "gift_id" uuid NOT NULL REFERENCES "gifts"("id") ON DELETE CASCADE,
        "claimed_by" text NOT NULL,
        "message" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "gift_claims_gift_id_idx" ON "gift_claims"("gift_id")`,
    ],
  },
  {
    name: 'messages_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "author_name" text NOT NULL,
        "message" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "messages_event_id_idx" ON "messages"("event_id")`,
      `CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at")`,
    ],
  },
  {
    name: 'events_frozen_at',
    statements: [
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "frozen_at" timestamp with time zone`,
    ],
  },
  {
    // 0016: Ensure tier column has a CHECK constraint (solo si no existe)
    name: 'users_tier_check',
    statements: [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tier_check') THEN ALTER TABLE "users" ADD CONSTRAINT "users_tier_check" CHECK (tier IN ('free'::text, 'pro'::text, 'pro_plus'::text)); END IF; END $$`,
    ],
  },
  {
    name: 'events_status_photos',
    statements: [
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active'`,
      `ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false`,
      `CREATE INDEX IF NOT EXISTS "photos_is_featured_idx" ON "photos"("is_featured")`,
    ],
  },
  {
    name: 'events_frozen_at_idx',
    statements: [
      `CREATE INDEX IF NOT EXISTS "events_frozen_at_idx" ON "events"("frozen_at") WHERE "frozen_at" IS NOT NULL`,
    ],
  },
  {
    name: 'consent_arco_pro_fk',
    statements: [
      `ALTER TABLE "consent_records" DROP CONSTRAINT IF EXISTS consent_records_user_id_fkey, ADD CONSTRAINT consent_records_user_id_fkey FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
      `ALTER TABLE "consent_records" ALTER COLUMN "user_id" DROP NOT NULL`,
      `ALTER TABLE "arco_requests" DROP CONSTRAINT IF EXISTS arco_requests_user_id_fkey, ADD CONSTRAINT arco_requests_user_id_fkey FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
      `ALTER TABLE "arco_requests" ALTER COLUMN "user_id" DROP NOT NULL`,
      `ALTER TABLE "pro_payments" DROP CONSTRAINT IF EXISTS pro_payments_user_id_fkey, ADD CONSTRAINT pro_payments_user_id_fkey FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
      `ALTER TABLE "pro_payments" ALTER COLUMN "user_id" DROP NOT NULL`,
    ],
  },
  {
    name: 'cash_contributions_amount_check',
    statements: [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_contributions_amount_check') THEN ALTER TABLE "cash_contributions" ADD CONSTRAINT "cash_contributions_amount_check" CHECK (amount > 0); END IF; END $$`,
    ],
  },
  {
    // 0020: Add onboarding_completed column
    name: 'onboarding_completed',
    statements: [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false`,
      `UPDATE "users" SET "onboarding_completed" = false WHERE "onboarding_completed" IS NULL`,
      `ALTER TABLE "users" ALTER COLUMN "onboarding_completed" SET NOT NULL`,
    ],
  },
  {
    // 0021: Add welcome_tutorial_completed column
    name: 'welcome_tutorial_completed',
    statements: [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "welcome_tutorial_completed" boolean DEFAULT false`,
      `UPDATE "users" SET "welcome_tutorial_completed" = false WHERE "welcome_tutorial_completed" IS NULL`,
      `ALTER TABLE "users" ALTER COLUMN "welcome_tutorial_completed" SET NOT NULL`,
    ],
  },
  {
    // 0022: email_suppressions table for bounce/complaint handling
    name: 'email_suppressions',
    statements: [
      `CREATE TABLE IF NOT EXISTS "email_suppressions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "reason" text NOT NULL,
        "occurred_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_email_unique_idx" ON "email_suppressions"("email")`,
    ],
  },
  {
    name: 'event_views_viewed_at_idx',
    statements: [
      `CREATE INDEX IF NOT EXISTS "event_views_viewed_at_idx" ON "event_views"("viewed_at")`,
    ],
  },
  {
    name: 'cash_contributions_amount_max_check',
    statements: [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_contributions_amount_max_check') THEN ALTER TABLE "cash_contributions" ADD CONSTRAINT "cash_contributions_amount_max_check" CHECK (amount <= 500000); END IF; END $$`,
    ],
  },
  {
    name: 'messages_event_id_created_at_idx',
    statements: [
      `CREATE INDEX IF NOT EXISTS "messages_event_id_created_at_idx" ON "messages"("event_id", "created_at")`,
    ],
  },
  {
    name: 'guests_event_id_name_unique_idx',
    statements: [
      `CREATE UNIQUE INDEX IF NOT EXISTS "guests_event_id_name_unique_idx" ON "guests"("event_id", "name")`,
    ],
  },
  {
    name: 'subscriptions_mp_subscription_id_unique_idx',
    statements: [
      `CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_mp_subscription_id_unique_idx" ON "subscriptions"("mp_subscription_id")`,
    ],
  },
  {
    name: 'consent_records_immutable_trigger',
    statements: [
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'consent_records_immutable_trigger') THEN
          CREATE OR REPLACE FUNCTION prevent_consent_mutation()
          RETURNS TRIGGER AS $f$
          BEGIN
            RAISE EXCEPTION 'consent_records are immutable and cannot be modified or deleted';
          END;
          $f$ LANGUAGE plpgsql;
          CREATE TRIGGER consent_records_immutable_trigger
            BEFORE UPDATE OR DELETE ON "consent_records"
            FOR EACH ROW EXECUTE FUNCTION prevent_consent_mutation();
        END IF;
      END $$`,
    ],
  },
  {
    name: 'audit_logs_immutable_trigger',
    statements: [
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_logs_immutable_trigger') THEN
          CREATE OR REPLACE FUNCTION prevent_audit_mutation()
          RETURNS TRIGGER AS $f$
          BEGIN
            RAISE EXCEPTION 'audit_logs are immutable and cannot be modified or deleted';
          END;
          $f$ LANGUAGE plpgsql;
          CREATE TRIGGER audit_logs_immutable_trigger
            BEFORE UPDATE OR DELETE ON "audit_logs"
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
        END IF;
      END $$`,
    ],
  },
  {
    // Revierte audit_logs_immutable_trigger: rompe resetLockout/resetEmailLockout
    // que hacen DELETE legítimo para limpiar intentos fallidos tras login exitoso.
    name: 'remove_audit_logs_immutable_trigger',
    statements: [
      `DROP TRIGGER IF EXISTS audit_logs_immutable_trigger ON "audit_logs"`,
      `DROP FUNCTION IF EXISTS prevent_audit_mutation`,
    ],
  },
  // Escalabilidad 100x: índices compuestos para queries de alta frecuencia
  {
    name: 'scalability_indexes_phase1',
    statements: [
      // Lockout queries (cada login)
      `CREATE INDEX IF NOT EXISTS "audit_logs_user_id_action_created_at_idx" ON "audit_logs"("user_id", "action", "created_at")`,
      `CREATE INDEX IF NOT EXISTS "audit_logs_action_ip_address_created_at_idx" ON "audit_logs"("action", "ip_address", "created_at")`,
      `CREATE INDEX IF NOT EXISTS "audit_logs_action_resource_id_created_at_idx" ON "audit_logs"("action", "resource_id", "created_at")`,
      // Eventos congelados (cron diario de purge/freeze)
      `CREATE INDEX IF NOT EXISTS "events_frozen_at_deleted_at_idx" ON "events"("frozen_at", "deleted_at") WHERE "frozen_at" IS NOT NULL AND "deleted_at" IS NULL`,
      // Listado público de eventos (public.ts, reminder.ts)
      `CREATE INDEX IF NOT EXISTS "events_public_listing_idx" ON "events"("is_active", "deleted_at", "status", "created_at") WHERE "is_active" = true AND "deleted_at" IS NULL AND "status" = 'active'`,
      // Cleanup de refresh tokens (cron)
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at")`,
      // Idempotencia de cash contributions
      `CREATE INDEX IF NOT EXISTS "cash_contributions_idempotency_idx" ON "cash_contributions"("cash_fund_id", "contributor_name", "amount", "status")`,
      // Cleanup de event_views por fecha
      `CREATE INDEX IF NOT EXISTS "event_views_viewed_at_standalone_idx" ON "event_views"("viewed_at")`,
      // Subscripciones atascadas por status + created_at
      `CREATE INDEX IF NOT EXISTS "subscriptions_status_created_at_idx" ON "subscriptions"("status", "created_at")`,
    ],
  },
  {
    name: 'last_sequence_check_column',
    statements: [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_sequence_check" timestamp with time zone`,
    ],
  },
  // 🔴 CRITICAL: needed by auth.ts register() — cada registro falla sin esta columna
  {
    name: 'users_token_version',
    statements: [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0`,
    ],
  },
  // 🔴 CRITICAL: needed by mp-webhooks.ts:57 — cada webhook de pago falla sin esta columna
  {
    name: 'pro_payments_tier',
    statements: [
      `ALTER TABLE "pro_payments" ADD COLUMN IF NOT EXISTS "tier" text NOT NULL DEFAULT 'pro'`,
    ],
  },
  // 🟡 Preventiva: todas las columnas del schema sin ADD COLUMN previo
  {
    name: 'ensure_all_schema_columns',
    statements: [
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone`,
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_date" timestamp with time zone`,
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_location" text`,
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_note" text`,
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "view_count" integer NOT NULL DEFAULT 0`,
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "mp_subscription_id" text`,
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "tier" text NOT NULL DEFAULT 'free'`,
      `ALTER TABLE "cash_contributions" ADD COLUMN IF NOT EXISTS "fee_amount" integer NOT NULL DEFAULT 0`,
      `ALTER TABLE "cash_contributions" ADD COLUMN IF NOT EXISTS "net_amount" integer NOT NULL DEFAULT 0`,
      `ALTER TABLE "cash_contributions" ADD COLUMN IF NOT EXISTS "mp_payment_id" text`,
      `ALTER TABLE "pro_payments" ADD COLUMN IF NOT EXISTS "interval" text NOT NULL DEFAULT 'month'`,
      `ALTER TABLE "failed_webhooks" ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0`,
      `ALTER TABLE "failed_webhooks" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'pending'`,
      `ALTER TABLE "event_views" ADD COLUMN IF NOT EXISTS "referrer" text`,
      `ALTER TABLE "event_views" ADD COLUMN IF NOT EXISTS "user_agent" text`,
    ],
  },
  // 🔴 CRITICAL: refresh_tokens family_id/rotated_from (RTR) — solo existían en
  // 0022_add_token_family_and_version.sql (legacy, nunca ejecutado por el runner).
  // Sin estas columnas, cada login/register/refresh falla con
  // 'column "family_id" of relation "refresh_tokens" does not exist'.
  {
    name: 'refresh_tokens_family_id',
    statements: [
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "family_id" uuid`,
    ],
  },
  {
    name: 'refresh_tokens_rotated_from',
    statements: [
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "rotated_from" uuid REFERENCES "refresh_tokens"("id") ON DELETE SET NULL`,
    ],
  },
  {
    name: 'refresh_tokens_rtr_indexes',
    statements: [
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id")`,
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_rotated_from_idx" ON "refresh_tokens"("rotated_from")`,
    ],
  },
  // 🟡 Dedupe de emails: unique (user_id, type) existe solo en legacy 0002 —
  // sin él, past_due/purge/reminder/sequence pueden duplicar emails.
  {
    name: 'email_tracking_user_id_type_unique_idx',
    statements: [
      `CREATE UNIQUE INDEX IF NOT EXISTS "email_tracking_user_id_type_unique_idx" ON "email_tracking"("user_id", "type")`,
    ],
  },
  // 🟡 Slug único soft-delete-aware: la constraint completa legacy bloquea
  // reusar el slug de un evento eliminado ("Ya existe un evento con ese nombre").
  {
    name: 'events_slug_unique_partial',
    statements: [
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_slug_unique') THEN
          ALTER TABLE "events" DROP CONSTRAINT "events_slug_unique";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'events_slug_unique' AND tablename = 'events') THEN
          DROP INDEX "events_slug_unique";
        END IF;
      END $$`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_unique" ON "events"("slug") WHERE "deleted_at" IS NULL`,
    ],
  },
  // 🟡 Idem para gifts: (event_id, name) parcial — permite re-agregar el
  // nombre de un regalo eliminado.
  {
    name: 'gifts_event_id_name_unique_partial',
    statements: [
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_event_id_name_unique') THEN
          ALTER TABLE "gifts" DROP CONSTRAINT "gifts_event_id_name_unique";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'gifts_event_id_name_unique' AND tablename = 'gifts') THEN
          DROP INDEX "gifts_event_id_name_unique";
        END IF;
      END $$`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "gifts_event_id_name_unique" ON "gifts"("event_id", "name") WHERE "deleted_at" IS NULL`,
    ],
  },
  // Bootstrap: CREATE TABLE IF NOT EXISTS de las tablas que solo existían en
  // SQL legacy (nunca ejecutados por el runner). Reproducen schema.ts con
  // timestamptz — no-op en DBs existentes, permiten arrancar en DBs nuevas.
  {
    name: 'bootstrap_users_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "name" text NOT NULL,
        "tier" text NOT NULL DEFAULT 'free',
        "last_sequence_check" timestamptz,
        "email_verified" boolean NOT NULL DEFAULT false,
        "onboarding_completed" boolean NOT NULL DEFAULT false,
        "welcome_tutorial_completed" boolean NOT NULL DEFAULT false,
        "verification_token" text,
        "verification_token_expires" timestamptz,
        "reset_token" text,
        "reset_token_expires" timestamptz,
        "token_version" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE("email")
      )`,
      `CREATE INDEX IF NOT EXISTS "users_verification_token_idx" ON "users"("verification_token")`,
      `CREATE INDEX IF NOT EXISTS "users_reset_token_idx" ON "users"("reset_token")`,
      `CREATE INDEX IF NOT EXISTS "users_token_version_idx" ON "users"("token_version")`,
    ],
  },
  {
    name: 'bootstrap_events_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "event_type" text NOT NULL DEFAULT 'BABY_SHOWER',
        "host_phone" text,
        "slug" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','completed','paused')),
        "is_active" boolean NOT NULL DEFAULT true,
        "deleted_at" timestamptz,
        "event_date" timestamptz,
        "event_location" text,
        "event_note" text,
        "frozen_at" timestamptz,
        "view_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "events_user_id_idx" ON "events"("user_id")`,
      `CREATE INDEX IF NOT EXISTS "events_user_id_deleted_at_idx" ON "events"("user_id", "deleted_at")`,
      `CREATE INDEX IF NOT EXISTS "events_deleted_at_idx" ON "events"("deleted_at")`,
      `CREATE INDEX IF NOT EXISTS "events_user_id_is_active_deleted_at_idx" ON "events"("user_id", "is_active", "deleted_at")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_unique" ON "events"("slug") WHERE "deleted_at" IS NULL`,
    ],
  },
  {
    name: 'bootstrap_gifts_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "gifts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "is_claimed" boolean NOT NULL DEFAULT false,
        "claimed_by" text,
        "is_group_gift" boolean NOT NULL DEFAULT false,
        "deleted_at" timestamptz,
        "created_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "gifts_event_id_deleted_at_idx" ON "gifts"("event_id", "deleted_at")`,
      `CREATE INDEX IF NOT EXISTS "gifts_event_id_unclaimed_idx" ON "gifts"("event_id") WHERE "is_claimed" = false`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "gifts_event_id_name_unique" ON "gifts"("event_id", "name") WHERE "deleted_at" IS NULL`,
    ],
  },
  {
    name: 'bootstrap_photos_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "photos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "url" text NOT NULL,
        "caption" text,
        "is_featured" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "deleted_at" timestamptz
      )`,
      `CREATE INDEX IF NOT EXISTS "photos_event_id_idx" ON "photos"("event_id")`,
    ],
  },
  {
    name: 'bootstrap_subscriptions_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "mp_subscription_id" text,
        "status" text NOT NULL DEFAULT 'incomplete',
        "tier" text NOT NULL DEFAULT 'free',
        "current_period_start" timestamptz,
        "current_period_end" timestamptz,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
      )`,
      `CREATE INDEX IF NOT EXISTS "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_mp_subscription_id_unique_idx" ON "subscriptions"("mp_subscription_id")`,
    ],
  },
  {
    name: 'bootstrap_cash_funds_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "cash_funds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "title" text NOT NULL DEFAULT 'Lluvia de sobres',
        "description" text,
        "target_amount" integer,
        "collected_amount" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "bank_phone" text,
        "bank_type" text,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "cash_funds_event_id_unique" UNIQUE("event_id")
      )`,
    ],
  },
  {
    name: 'bootstrap_cash_contributions_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "cash_contributions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cash_fund_id" uuid NOT NULL REFERENCES "cash_funds"("id") ON DELETE CASCADE,
        "contributor_name" text NOT NULL,
        "message" text,
        "amount" integer NOT NULL,
        "fee_amount" integer NOT NULL DEFAULT 0,
        "net_amount" integer NOT NULL DEFAULT 0,
        "mp_payment_id" text,
        "status" text NOT NULL DEFAULT 'promised' CHECK ("status" IN ('promised','paid','cancelled')),
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "cash_contributions_mp_payment_id_unique" UNIQUE("mp_payment_id")
      )`,
      `CREATE INDEX IF NOT EXISTS "cash_contributions_cash_fund_id_idx" ON "cash_contributions"("cash_fund_id")`,
      `CREATE INDEX IF NOT EXISTS "cash_contributions_status_created_at_idx" ON "cash_contributions"("status", "created_at")`,
    ],
  },
  {
    name: 'bootstrap_pro_payments_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "pro_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "mp_payment_id" text NOT NULL,
        "amount" integer NOT NULL,
        "interval" text NOT NULL DEFAULT 'month',
        "tier" text NOT NULL DEFAULT 'pro',
        "status" text NOT NULL DEFAULT 'completed',
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pro_payments_mp_payment_id_unique" UNIQUE("mp_payment_id")
      )`,
      `CREATE INDEX IF NOT EXISTS "pro_payments_user_id_idx" ON "pro_payments"("user_id")`,
    ],
  },
  {
    name: 'bootstrap_failed_webhooks_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "failed_webhooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "topic" text NOT NULL,
        "resource_id" text NOT NULL,
        "error_message" text,
        "retry_count" integer NOT NULL DEFAULT 0,
        "last_attempt_at" timestamptz,
        "next_retry_at" timestamptz,
        "status" text NOT NULL DEFAULT 'pending',
        "created_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "failed_webhooks_status_idx" ON "failed_webhooks"("status")`,
      `CREATE INDEX IF NOT EXISTS "failed_webhooks_next_retry_at_idx" ON "failed_webhooks"("next_retry_at")`,
    ],
  },
  {
    name: 'bootstrap_platform_fees_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "platform_fees" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "contribution_id" uuid NOT NULL REFERENCES "cash_contributions"("id") ON DELETE CASCADE,
        "amount" integer NOT NULL,
        "fee_amount" integer NOT NULL,
        "net_amount" integer NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "platform_fees_contribution_id_idx" ON "platform_fees"("contribution_id")`,
    ],
  },
  {
    name: 'bootstrap_email_tracking_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "email_tracking" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "sent_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "email_tracking_user_id_type_unique_idx" ON "email_tracking"("user_id", "type")`,
      `CREATE INDEX IF NOT EXISTS "email_tracking_sent_at_idx" ON "email_tracking"("sent_at")`,
      `CREATE INDEX IF NOT EXISTS "email_tracking_user_id_type_sent_at_idx" ON "email_tracking"("user_id", "type", "sent_at")`,
    ],
  },
  {
    name: 'bootstrap_event_views_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "event_views" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "referrer" text,
        "user_agent" text,
        "viewed_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "event_views_event_id_viewed_at_idx" ON "event_views"("event_id", "viewed_at")`,
    ],
  },
  {
    name: 'bootstrap_refresh_tokens_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "family_id" uuid,
        "rotated_from" uuid REFERENCES "refresh_tokens"("id") ON DELETE SET NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash")`,
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id")`,
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id")`,
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_rotated_from_idx" ON "refresh_tokens"("rotated_from")`,
    ],
  },
  {
    name: 'bootstrap_consent_records_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "consent_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "type" text NOT NULL,
        "version" text NOT NULL DEFAULT '1.0',
        "ip_address" text,
        "user_agent" text,
        "granted" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "consent_records_user_id_idx" ON "consent_records"("user_id")`,
    ],
  },
  {
    name: 'bootstrap_arco_requests_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "arco_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "request_type" text NOT NULL,
        "details" text,
        "status" text NOT NULL DEFAULT 'pending',
        "completed_at" timestamptz,
        "created_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "arco_requests_user_id_idx" ON "arco_requests"("user_id")`,
    ],
  },
  {
    name: 'bootstrap_audit_logs_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" text NOT NULL,
        "resource" text NOT NULL,
        "resource_id" text,
        "ip_address" text,
        "user_agent" text,
        "metadata" text,
        "created_at" timestamptz DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id")`,
      `CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action")`,
      `CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at")`,
    ],
  },
  // Drift: schema.ts usa default 'promised' pero la DB real (legacy 0000) quedó
  // con 'pending'. SET DEFAULT es idempotente — repetirlo es seguro.
  {
    name: 'cash_contributions_status_default_fix',
    statements: [
      `ALTER TABLE "cash_contributions" ALTER COLUMN "status" SET DEFAULT 'promised'`,
    ],
  },
  // El boost nunca se habilitó ni se habilitará: eliminar todo rastro.
  // DROP COLUMN/TABLE IF EXISTS son idempotentes — no-ops donde no existan.
  {
    name: 'drop_events_boosted_until',
    statements: [
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "boosted_until"`,
      `DROP TABLE IF EXISTS "boost_payments"`,
    ],
  },
  {
    name: 'subscriptions_cancel_requested_at',
    statements: [
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_requested_at" timestamp with time zone`,
    ],
  },
];

// 0015: Convert all timestamp → timestamptz for consistent UTC storage.
// PostgreSQL detects when ALTER COLUMN type matches the existing type and
// skips the rewrite, so these are safe to run multiple times.
const TIMESTAMPTZ_ALTERS: string[] = [
  `ALTER TABLE users ALTER COLUMN last_sequence_check TYPE TIMESTAMPTZ USING last_sequence_check AT TIME ZONE 'UTC'`,
  `ALTER TABLE users ALTER COLUMN verification_token_expires TYPE TIMESTAMPTZ USING verification_token_expires AT TIME ZONE 'UTC'`,
  `ALTER TABLE users ALTER COLUMN reset_token_expires TYPE TIMESTAMPTZ USING reset_token_expires AT TIME ZONE 'UTC'`,
  `ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE events ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE events ALTER COLUMN event_date TYPE TIMESTAMPTZ USING event_date AT TIME ZONE 'UTC'`,
  `ALTER TABLE events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE events ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE gifts ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE gifts ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE gift_claims ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE photos ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE photos ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE subscriptions ALTER COLUMN current_period_start TYPE TIMESTAMPTZ USING current_period_start AT TIME ZONE 'UTC'`,
  `ALTER TABLE subscriptions ALTER COLUMN current_period_end TYPE TIMESTAMPTZ USING current_period_end AT TIME ZONE 'UTC'`,
  `ALTER TABLE subscriptions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE subscriptions ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE cash_funds ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE cash_funds ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE cash_contributions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE pro_payments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE failed_webhooks ALTER COLUMN last_attempt_at TYPE TIMESTAMPTZ USING last_attempt_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE failed_webhooks ALTER COLUMN next_retry_at TYPE TIMESTAMPTZ USING next_retry_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE failed_webhooks ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE platform_fees ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE guests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE email_tracking ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE event_views ALTER COLUMN viewed_at TYPE TIMESTAMPTZ USING viewed_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE refresh_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE refresh_tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE consent_records ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE arco_requests ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE arco_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
  `ALTER TABLE audit_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
];

const TIMESTAMPTZ_MIGRATION_NAME = 'timestamptz_conversion';

export async function runMigrations(): Promise<void> {
  // Acquire migration lock via DB table (works with any pool config, unlike advisory locks)
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS "migration_lock" ("id" integer PRIMARY KEY, "locked_at" timestamptz NOT NULL DEFAULT now())`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_migration_lock_locked_at ON migration_lock(locked_at)`);
  await sql.unsafe(`DELETE FROM "migration_lock" WHERE "locked_at" < now() - interval '30 minutes'`);
  const lockResult = await sql`INSERT INTO "migration_lock" ("id", "locked_at") VALUES (1, now()) ON CONFLICT ("id") DO NOTHING RETURNING "locked_at"`;
  if (lockResult.length === 0) {
    log.info('Otra instancia está ejecutando migraciones — omitiendo');
    return;
  }

  const heartbeatTimer = setInterval(async () => {
    try { await sql`UPDATE "migration_lock" SET "locked_at" = now() WHERE "id" = 1`; } catch {}
  }, 60_000);

  try {
  // Ensure migration_journal table exists
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "migration_journal" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const appliedRows = await sql`SELECT "name" FROM "migration_journal"`;
  const appliedNames = new Set(appliedRows.map((r: any) => r.name));

  // Aplicar cada migración por nombre; cada entrada agrupa una o más sentencias SQL.
  for (const migration of COLUMN_MIGRATIONS) {
    if (appliedNames.has(migration.name)) continue;

    log.info({ migration: migration.name }, 'Aplicando migración');
    let allOk = true;
    for (const statement of migration.statements) {
      try {
        await sql.unsafe(statement);
      } catch (err) {
        const isAlreadyExists = err instanceof Error && /already exists|duplicate/i.test(err.message);
        if (!isAlreadyExists) {
          log.warn({ migration: migration.name, err }, 'Sentencia falló — saltando');
          allOk = false;
        }
      }
    }

    if (allOk) {
      try {
        await sql`INSERT INTO "migration_journal" ("name") VALUES (${migration.name}) ON CONFLICT DO NOTHING`;
      } catch {}
      log.info({ migration: migration.name }, 'Migración aplicada');
    } else {
      log.warn({ migration: migration.name }, 'Migración parcialmente fallida — no se registra para reintentar en próximo arranque');
    }
  }

  // Apply timestamptz conversion, each ALTER individually wrapped in IF EXISTS
  if (!appliedNames.has(TIMESTAMPTZ_MIGRATION_NAME)) {
    log.info({ migration: TIMESTAMPTZ_MIGRATION_NAME }, 'Aplicando migración timestamptz');
    let anyFailed = false;

    for (const statement of TIMESTAMPTZ_ALTERS) {
      // Only run if the column exists
      const match = statement.match(/ALTER TABLE (\w+) ALTER COLUMN (\w+)/i);
      if (match) {
        const table = match[1];
        const column = match[2];
        try {
          const exists = await sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = ${table} AND column_name = ${column}
          `;
          if (exists.length > 0) {
            await sql.unsafe(statement);
          } else {
            log.warn({ table, column }, 'Columna no existe, saltando conversión timestamptz');
            anyFailed = true;
          }
        } catch (err) {
          log.warn({ table, column, err }, 'Error en conversión timestamptz — saltando');
          anyFailed = true;
        }
      }
    }

    if (!anyFailed) {
      await sql`INSERT INTO "migration_journal" ("name") VALUES (${TIMESTAMPTZ_MIGRATION_NAME}) ON CONFLICT DO NOTHING`;
      log.info({ migration: TIMESTAMPTZ_MIGRATION_NAME }, 'Migración timestamptz aplicada');
    } else {
      log.warn('Algunas conversiones timestamptz fallaron — no se marca como aplicada');
    }
  }

  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    await sql`DELETE FROM "migration_lock" WHERE "id" = 1`.catch(() => {});
  }

  log.info('Migraciones ejecutadas');
}

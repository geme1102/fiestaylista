import { sql } from './index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Migrations');

const COLUMN_MIGRATIONS: string[] = [
  `ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp`,

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

  `ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_phone" text`,
  `ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_type" text`,

  `ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "is_group_gift" boolean NOT NULL DEFAULT false`,

  `CREATE TABLE IF NOT EXISTS "gift_claims" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "gift_id" uuid NOT NULL REFERENCES "gifts"("id") ON DELETE CASCADE,
    "claimed_by" text NOT NULL,
    "message" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "gift_claims_gift_id_idx" ON "gift_claims"("gift_id")`,

  `CREATE TABLE IF NOT EXISTS "messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
    "author_name" text NOT NULL,
    "message" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "messages_event_id_idx" ON "messages"("event_id")`,
  `CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at")`,

  `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "frozen_at" timestamp with time zone`,

  // 0016: Ensure tier column has a CHECK constraint (solo si no existe)
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tier_check') THEN ALTER TABLE "users" ADD CONSTRAINT "users_tier_check" CHECK (tier IN ('free'::text, 'pro'::text, 'pro_plus'::text)); END IF; END $$`,

  `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "photos_is_featured_idx" ON "photos"("is_featured")`,

  `CREATE INDEX IF NOT EXISTS "events_frozen_at_idx" ON "events"("frozen_at") WHERE "frozen_at" IS NOT NULL`,

  `ALTER TABLE "consent_records" DROP CONSTRAINT IF EXISTS consent_records_user_id_fkey, ADD CONSTRAINT consent_records_user_id_fkey FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
  `ALTER TABLE "consent_records" ALTER COLUMN "user_id" DROP NOT NULL`,
  `ALTER TABLE "arco_requests" DROP CONSTRAINT IF EXISTS arco_requests_user_id_fkey, ADD CONSTRAINT arco_requests_user_id_fkey FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
  `ALTER TABLE "arco_requests" ALTER COLUMN "user_id" DROP NOT NULL`,

  `ALTER TABLE "pro_payments" DROP CONSTRAINT IF EXISTS pro_payments_user_id_fkey, ADD CONSTRAINT pro_payments_user_id_fkey FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
  `ALTER TABLE "pro_payments" ALTER COLUMN "user_id" DROP NOT NULL`,

  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_contributions_amount_check') THEN ALTER TABLE "cash_contributions" ADD CONSTRAINT "cash_contributions_amount_check" CHECK (amount > 0); END IF; END $$`,

  // 0020: Add onboarding_completed column
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false`,
  `UPDATE "users" SET "onboarding_completed" = false WHERE "onboarding_completed" IS NULL`,
  `ALTER TABLE "users" ALTER COLUMN "onboarding_completed" SET NOT NULL`,

  // 0021: Add welcome_tutorial_completed column
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "welcome_tutorial_completed" boolean DEFAULT false`,
  `UPDATE "users" SET "welcome_tutorial_completed" = false WHERE "welcome_tutorial_completed" IS NULL`,
  `ALTER TABLE "users" ALTER COLUMN "welcome_tutorial_completed" SET NOT NULL`,
];

// Stable names matching COLUMN_MIGRATIONS order — new migrations must append here + to COLUMN_MIGRATIONS.
const COLUMN_MIGRATION_NAMES = [
  'photos_deleted_at',
  'guests_table',
  'cash_funds_bank_fields',
  'gifts_is_group_gift',
  'gift_claims_table',
  'messages_table',
  'events_frozen_at',
  'users_tier_check',
  'events_status_photos',
  'events_frozen_at_idx',
  'consent_arco_pro_fk',
  'cash_contributions_amount_check',
  'onboarding_completed',
  'welcome_tutorial_completed',
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
  `ALTER TABLE events ALTER COLUMN boosted_until TYPE TIMESTAMPTZ USING boosted_until AT TIME ZONE 'UTC'`,
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

    await sql.begin(async (tx) => {
      for (let i = 0; i < COLUMN_MIGRATIONS.length; i++) {
        const name = COLUMN_MIGRATION_NAMES[i];
        if (!appliedNames.has(name)) {
          log.info({ migration: name }, 'Aplicando migración');
          await tx.unsafe(COLUMN_MIGRATIONS[i]);
          await tx`INSERT INTO "migration_journal" ("name") VALUES (${name}) ON CONFLICT DO NOTHING`;
          log.info({ migration: name }, 'Migración aplicada');
        }
      }

      if (!appliedNames.has(TIMESTAMPTZ_MIGRATION_NAME)) {
        log.info({ migration: TIMESTAMPTZ_MIGRATION_NAME }, 'Aplicando migración timestamptz');
        for (const statement of TIMESTAMPTZ_ALTERS) {
          await tx.unsafe(statement);
        }
        await tx`INSERT INTO "migration_journal" ("name") VALUES (${TIMESTAMPTZ_MIGRATION_NAME}) ON CONFLICT DO NOTHING`;
        log.info({ migration: TIMESTAMPTZ_MIGRATION_NAME }, 'Migración timestamptz aplicada');
      }
    });
    log.info('Migraciones aplicadas correctamente');
  } catch (e) {
    log.error('Migraciones fallidas, rollback ejecutado');
    throw e;
  }
}

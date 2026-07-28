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
  // Acquire migration lock via DB table (works with any pool config, unlike advisory locks)
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS "migration_lock" ("id" integer PRIMARY KEY, "locked_at" timestamptz NOT NULL DEFAULT now())`);
  await sql.unsafe(`DELETE FROM "migration_lock" WHERE "locked_at" < now() - interval '5 minutes'`);
  const lockResult = await sql`INSERT INTO "migration_lock" ("id", "locked_at") VALUES (1, now()) ON CONFLICT ("id") DO NOTHING RETURNING "locked_at"`;
  if (lockResult.length === 0) {
    log.info('Otra instancia está ejecutando migraciones — omitiendo');
    return;
  }

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
    await sql`DELETE FROM "migration_lock" WHERE "id" = 1`.catch(() => {});
  }

  log.info('Migraciones ejecutadas');
}

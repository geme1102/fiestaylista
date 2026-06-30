import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema.js';

const TEST_DB_URL =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

let sql: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (TEST_DB_URL) {
  sql = postgres(TEST_DB_URL, { max: 1 });
  db = drizzle(sql, { schema });
}

export { db, sql };

const PASSWORD_HASH =
  '$2a$10$8KzQMG5I6q4GxJQ6q4GxJuVq4GxJQ6q4GxJQ6q4GxJQ6q4GxJQ6q';

export async function createTestUser(
  overrides: Partial<typeof schema.users.$inferInsert> = {},
) {
  if (!db) throw new Error('Database not configured — missing DATABASE_URL_TEST');
  const suffix = Date.now();
  const defaults: typeof schema.users.$inferInsert = {
    email: `integration-test-${suffix}@fiestaylista.test`,
    passwordHash: PASSWORD_HASH,
    name: 'Integration Test User',
    tier: 'free',
    emailVerified: true,
  };
  const [user] = await db
    .insert(schema.users)
    .values({ ...defaults, ...overrides })
    .returning();
  return user;
}

export async function createTestEvent(
  userId: string,
  overrides: Partial<typeof schema.events.$inferInsert> = {},
) {
  if (!db) throw new Error('Database not configured — missing DATABASE_URL_TEST');
  const suffix = Date.now();
  const defaults: typeof schema.events.$inferInsert = {
    userId,
    title: 'Integration Test Event',
    eventType: 'BABY_SHOWER',
    slug: `integration-test-${suffix}`,
  };
  const [event] = await db
    .insert(schema.events)
    .values({ ...defaults, ...overrides })
    .returning();
  return event;
}

export async function cleanDatabase() {
  if (!sql) return;
  await sql.unsafe(`
    TRUNCATE TABLE
      gift_claims, gifts, photos, cash_contributions, cash_funds,
      messages, guests, event_views, boost_payments, pro_payments,
      failed_webhooks, platform_fees, refresh_tokens, consent_records,
      arco_requests, audit_logs, email_tracking, subscriptions, events, users
    RESTART IDENTITY CASCADE
  `);
}

export async function closeConnection() {
  if (!sql) return;
  await sql.end();
}

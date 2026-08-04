import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { createHash } from 'node:crypto';

const MAX_FAILED_ATTEMPTS = 10;
const MAX_EMAIL_FAILED_ATTEMPTS = 15;
const LOCKOUT_MINUTES = 15;
const EMAIL_LOCKOUT_MINUTES = 30;
const WINDOW_MINUTES = 15;
const MAX_IP_ACROSS_ACCOUNTS = 20;
const MAX_IP_DISTINCT_ACCOUNTS = 3;

function emailHash(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export async function isLocked(userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.userId, userId),
      eq(auditLogs.action, 'auth.login.failed'),
      sql`${auditLogs.createdAt} >= ${windowStart.toISOString()}::timestamptz`,
    ))
    .limit(1);

  const count = rows[0]?.count ?? 0;
  if (count < MAX_FAILED_ATTEMPTS) return false;

  const [lastAttempt] = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.userId, userId),
      eq(auditLogs.action, 'auth.login.failed'),
    ))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (!lastAttempt) return false;

  const lockoutEnds = new Date(lastAttempt.createdAt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
  return Date.now() < lockoutEnds.getTime();
}

export async function isIpThrottled(ipAddress: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      distinctAccounts: sql<number>`count(DISTINCT ${auditLogs.userId})::int`,
    })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.action, 'auth.login.failed'),
      eq(auditLogs.ipAddress, ipAddress),
      sql`${auditLogs.createdAt} >= ${windowStart.toISOString()}::timestamptz`,
    ))
    .limit(1);

  const total = result?.total ?? 0;
  const distinct = result?.distinctAccounts ?? 0;

  return total >= MAX_IP_ACROSS_ACCOUNTS || distinct >= MAX_IP_DISTINCT_ACCOUNTS;
}

/**
 * Record a failed attempt keyed by email hash (for non-existent users)
 * This prevents enumeration by locking out repeated attempts on same email
 */
export async function recordEmailFailedAttempt(email: string, ipAddress: string): Promise<void> {
  const hashed = emailHash(email);
  await db.insert(auditLogs).values({
    action: 'auth.login.failed.email',
    resource: 'email',
    resourceId: hashed,
    ipAddress,
    metadata: JSON.stringify({ emailHash: hashed }),
  });
}

/**
 * Check if an email is temporarily locked out
 */
export async function isEmailLocked(email: string): Promise<boolean> {
  const hashed = emailHash(email);
  const windowStart = new Date(Date.now() - EMAIL_LOCKOUT_MINUTES * 60 * 1000);
  const r = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.action, 'auth.login.failed.email'),
      eq(auditLogs.resourceId, hashed),
      sql`${auditLogs.createdAt} >= ${windowStart.toISOString()}::timestamptz`
    ));
  return (r[0]?.count ?? 0) >= MAX_EMAIL_FAILED_ATTEMPTS;
}

/**
 * Reset email lockout (called on successful login)
 */
export async function resetEmailLockout(email: string): Promise<void> {
  const hashed = emailHash(email);
  await db
    .delete(auditLogs)
    .where(and(
      eq(auditLogs.action, 'auth.login.failed.email'),
      eq(auditLogs.resourceId, hashed)
    ));
}

/**
 * Fixed resetLockout - actually clears user's failed attempts by removing old audit logs
 * (keeps forensic trail for other actions but clears the failed-login window)
 */
export async function resetLockout(userId: string): Promise<void> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  await db
    .delete(auditLogs)
    .where(and(
      eq(auditLogs.userId, userId),
      eq(auditLogs.action, 'auth.login.failed'),
      sql`${auditLogs.createdAt} >= ${windowStart.toISOString()}::timestamptz`,
    ));
}

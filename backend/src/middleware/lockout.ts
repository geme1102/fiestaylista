import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;
const WINDOW_MINUTES = 15;

export async function isLocked(userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.userId, userId),
      eq(auditLogs.action, 'auth.login.failed'),
      sql`${auditLogs.createdAt} >= ${windowStart}`,
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

export async function getLockoutRemaining(userId: string): Promise<number> {
  const [lastAttempt] = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.userId, userId),
      eq(auditLogs.action, 'auth.login.failed'),
    ))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (!lastAttempt) return 0;

  const lockoutEnds = new Date(lastAttempt.createdAt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
  const remaining = Math.ceil((lockoutEnds.getTime() - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function recordFailedAttempt(_userId?: string): void {
  // AuditLogs already records failed attempts — no in-memory state needed
}

export function resetLockout(_userId: string): void {
  // Window-based — no explicit reset needed;
  // successful login naturally moves failures out of window
}

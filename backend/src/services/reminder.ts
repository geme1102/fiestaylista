import { eq, sql, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, gifts, users, emailTracking } from '../db/schema.js';
import { sendReminderEmail } from './email.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Reminder');

const REMINDER_COOLDOWN_DAYS = 7 as const;

interface ReminderResult {
  processed: number;
  reminded: number;
}

export async function processReminders(): Promise<ReminderResult> {
  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - REMINDER_COOLDOWN_DAYS);

  const rows = await db
    .select({
      id: events.id,
      userId: users.id,
      title: events.title,
      slug: events.slug,
      userEmail: users.email,
    })
    .from(events)
    .innerJoin(users, eq(events.userId, users.id))
    .where(
      and(
        sql`${events.isActive} = true`,
        sql`EXISTS (SELECT 1 FROM ${gifts} WHERE ${gifts.eventId} = ${events.id} AND ${gifts.isClaimed} = false)`,
        sql`NOT EXISTS (SELECT 1 FROM ${emailTracking} WHERE ${emailTracking.userId} = ${events.userId} AND ${emailTracking.type} = 'reminder' AND ${emailTracking.sentAt} > ${cooldownDate.toISOString()}::timestamptz)`,
      ),
    )
    .limit(50);

  const eventIds = rows.map(r => r.id);
  const unclaimedCounts = eventIds.length > 0
    ? await db
        .select({
          eventId: gifts.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(gifts)
        .where(and(inArray(gifts.eventId, eventIds), eq(gifts.isClaimed, false)))
        .groupBy(gifts.eventId)
    : [];

  const unclaimedMap = new Map(unclaimedCounts.map(u => [u.eventId, u.count]));

  let reminded = 0;

  for (const row of rows) {
    if (!row.userEmail) continue;

    const unclaimedCount = unclaimedMap.get(row.id) ?? 0;

    try {
      await sendReminderEmail(row.userEmail, row.title, row.slug, unclaimedCount);
      try {
        await db.insert(emailTracking).values({
          userId: row.userId,
          type: 'reminder',
        });
      } catch (err) {
        log.warn({ err }, 'Error insertando emailTracking para reminder — intentando update');
        await db.update(emailTracking)
          .set({ sentAt: new Date() })
          .where(and(eq(emailTracking.userId, row.userId), eq(emailTracking.type, 'reminder')));
      }
      reminded++;
    } catch (error) {
      log.error({ error }, `Error enviando email a ${row.userEmail}:`);
    }
  }

  return {
    processed: rows.length,
    reminded,
  };
}

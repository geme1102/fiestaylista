import { eq, sql, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, gifts, users, emailTracking } from '../db/schema.js';
import { sendReminderEmail } from './email.js';

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
      unclaimedCount: sql<number>`(SELECT count(*)::int FROM ${gifts} WHERE ${gifts.eventId} = ${events.id} AND ${gifts.isClaimed} = false)`,
    })
    .from(events)
    .innerJoin(users, eq(events.userId, users.id))
    .where(
      and(
        sql`${events.isActive} = true`,
        sql`EXISTS (SELECT 1 FROM ${gifts} WHERE ${gifts.eventId} = ${events.id} AND ${gifts.isClaimed} = false)`,
        sql`NOT EXISTS (SELECT 1 FROM ${emailTracking} WHERE ${emailTracking.userId} = ${events.userId} AND ${emailTracking.type} = 'reminder' AND ${emailTracking.sentAt} > ${cooldownDate.toISOString()})`,
      ),
    )
    .limit(50);

  let reminded = 0;

  for (const row of rows) {
    if (!row.userEmail) continue;

    try {
      await sendReminderEmail(row.userEmail, row.title, row.slug, row.unclaimedCount);
      await db.insert(emailTracking).values({
        userId: row.userId,
        type: 'reminder',
      });
      reminded++;
    } catch (error) {
      console.error(`[Reminder] Error enviando email a ${row.userEmail}:`, error);
    }
  }

  return {
    processed: rows.length,
    reminded,
  };
}

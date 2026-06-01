import { eq, sql, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, gifts, users, emailTracking } from '../db/schema.js';
import { sendReminderEmail } from './email.js';

const REMINDER_COOLDOWN_DAYS = 7;

interface ReminderResult {
  processed: number;
  reminded: number;
}

export async function processReminders(): Promise<ReminderResult> {
  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - REMINDER_COOLDOWN_DAYS);

  const eventsWithUnclaimed = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      userId: events.userId,
    })
    .from(events)
    .where(
      and(
        sql`${events.isActive} = true`,
        sql`${events.id} IN (
            SELECT ${gifts.eventId}
            FROM ${gifts}
            WHERE ${gifts.isClaimed} = false
          )`,
        sql`${events.userId} NOT IN (
            SELECT ${emailTracking.userId}
            FROM ${emailTracking}
            WHERE ${emailTracking.type} = 'reminder'
            AND ${emailTracking.sentAt} > ${cooldownDate.toISOString()}
          )`,
      ),
    )
    .limit(50);

  let reminded = 0;

  for (const event of eventsWithUnclaimed) {
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, event.userId))
      .limit(1);

    if (!user) continue;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gifts)
      .where(and(eq(gifts.eventId, event.id), sql`${gifts.isClaimed} = false`));

    const unclaimedCount = Number(countResult?.count ?? 0);

    try {
      await sendReminderEmail(user.email, event.title, event.slug, unclaimedCount);
      await db.insert(emailTracking).values({
        userId: event.userId,
        type: 'reminder',
      });
      reminded++;
    } catch (error) {
      console.error(`[Reminder] Error enviando email a ${user.email}:`, error);
    }
  }

  return {
    processed: eventsWithUnclaimed.length,
    reminded,
  };
}

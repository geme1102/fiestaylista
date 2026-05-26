import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, gifts, users } from '../db/schema.js';
import { sendReminderEmail } from './email.js';

interface ReminderResult {
  processed: number;
  reminded: number;
}

export async function processReminders(): Promise<ReminderResult> {
  const eventsWithUnclaimed = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      userId: events.userId,
    })
    .from(events)
    .where(
      sql`${events.isActive} = true
          AND ${events.id} IN (
            SELECT ${gifts.eventId}
            FROM ${gifts}
            WHERE ${gifts.isClaimed} = false
          )`,
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
      .where(sql`${gifts.eventId} = ${event.id} AND ${gifts.isClaimed} = false`);

    const unclaimedCount = Number(countResult?.count ?? 0);

    try {
      await sendReminderEmail(user.email, event.title, event.slug, unclaimedCount);
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

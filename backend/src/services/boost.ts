import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, cashFunds, auditLogs } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Boost');

export async function boostEvent(
  eventId: string,
  userId: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ boosted: boolean; boostedUntil: string }> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`);

    const [event] = await tx
      .select({ id: events.id, userId: events.userId, boostedUntil: events.boostedUntil })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .for('update')
      .limit(1);

    if (!event) throw new NotFoundError('Evento no encontrado');
    if (event.userId !== userId) throw new ForbiddenError('No tienes permiso');

    if (event.boostedUntil && new Date(event.boostedUntil) > new Date()) {
      return { boosted: false, boostedUntil: event.boostedUntil.toISOString() };
    }

    const boostedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await tx.update(events).set({ boostedUntil: sql`${boostedUntil}::timestamptz` }).where(eq(events.id, eventId));
    await tx.insert(cashFunds).values({ eventId, title: 'Lluvia de sobres', isActive: true }).onConflictDoNothing({ target: cashFunds.eventId });

    await tx.insert(auditLogs).values({
      userId,
      action: 'boost.activate',
      resource: 'event',
      resourceId: eventId,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      metadata: JSON.stringify({ boostedUntil }),
    });

    log.info({ userId, eventId }, 'Event boosted successfully');

    return { boosted: true, boostedUntil };
  });
}

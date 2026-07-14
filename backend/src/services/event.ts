import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, events as eventsTable, gifts, photos, cashFunds, giftClaims, messages, guests, eventViews, cashContributions } from '../db/schema.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { generateSlug } from '../utils/slug.js';
import { TIER_LIMITS } from '../types/index.js';
import type { EventType, Tier } from '../types/index.js';

export interface CreateEventData {
  title: string;
  eventType: EventType;
  hostPhone?: string;
  eventDate?: string;
  eventLocation?: string;
  eventNote?: string;
}

export interface UpdateEventData {
  title?: string;
  eventType?: EventType;
  hostPhone?: string;
  isActive?: boolean;
  eventDate?: string | null;
  eventLocation?: string | null;
  eventNote?: string | null;
}

export async function createEvent(userId: string, data: CreateEventData) {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

    const [user] = await tx
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const tier = (user?.tier ?? 'free') as Tier;
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(eventsTable)
      .where(and(eq(eventsTable.userId, userId), isNull(eventsTable.deletedAt)));

    const eventCount = Number(countResult?.count ?? 0);
    if (eventCount >= limits.maxEvents) {
      throw new ForbiddenError(`Has alcanzado el límite de ${limits.maxEvents} eventos en tu plan ${tier}`);
    }

    const baseSlug = generateSlug(data.title);

    let slug = baseSlug;
    let slugOk = false;
    for (let attempt = 1; attempt < 100; attempt++) {
      const existing = await tx
        .select({ id: eventsTable.id })
        .from(eventsTable)
        .where(and(eq(eventsTable.slug, slug), isNull(eventsTable.deletedAt)))
        .limit(1);
      if (!existing.length) { slugOk = true; break; }
      slug = `${baseSlug}-${attempt}`;
    }
    if (!slugOk) throw new ValidationError('No se pudo generar un enlace único para este nombre. Intenta con otro título.');

    let event: typeof eventsTable.$inferSelect | undefined;
    try {
      [event] = await tx
        .insert(eventsTable)
        .values({
          userId,
          title: data.title,
          eventType: data.eventType,
          hostPhone: data.hostPhone || null,
          eventDate: data.eventDate ? new Date(data.eventDate) : null,
          eventLocation: data.eventLocation || null,
          eventNote: data.eventNote || null,
          slug,
        })
        .returning();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ValidationError('Ya existe un evento con ese nombre o slug. Intenta con otro título.');
      }
      throw err;
    }

    return event;
  });
}

export async function updateEvent(eventId: string, userId: string, data: UpdateEventData) {
  if (data.isActive === true) {
    return await db.transaction(async (tx) => {
      const [currentEvent] = await tx
        .select({ frozenAt: eventsTable.frozenAt })
        .from(eventsTable)
        .where(eq(eventsTable.id, eventId))
        .limit(1);

      if (currentEvent?.frozenAt) {
        throw new ValidationError('Este evento está congelado. Reactívalo desde la configuración.');
      }

      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

      const [user] = await tx
        .select({ tier: users.tier })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const tier = (user?.tier ?? 'free') as Tier;
      const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

      const [countResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(eventsTable)
        .where(and(
          eq(eventsTable.userId, userId),
          eq(eventsTable.isActive, true),
          isNull(eventsTable.deletedAt),
          sql`${eventsTable.id} != ${eventId}`,
        ));

      const activeCount = Number(countResult?.count ?? 0);
      if (activeCount >= limits.maxEvents) {
        throw new ValidationError(`Has alcanzado el límite de ${limits.maxEvents} eventos activos en tu plan ${tier}`);
      }

      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.eventType !== undefined) updateData.eventType = data.eventType;
      if (data.hostPhone !== undefined) updateData.hostPhone = data.hostPhone;
      updateData.isActive = true;
      updateData.frozenAt = null;
      if (data.eventDate !== undefined) updateData.eventDate = data.eventDate ? new Date(data.eventDate) : null;
      if (data.eventLocation !== undefined) updateData.eventLocation = data.eventLocation;
      if (data.eventNote !== undefined) updateData.eventNote = data.eventNote;
      updateData.updatedAt = new Date();

      const [event] = await tx
        .update(eventsTable)
        .set(updateData)
        .where(and(eq(eventsTable.id, eventId), eq(eventsTable.userId, userId)))
        .returning();

      return event;
    });
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.eventType !== undefined) updateData.eventType = data.eventType;
  if (data.hostPhone !== undefined) updateData.hostPhone = data.hostPhone;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.eventDate !== undefined) updateData.eventDate = data.eventDate ? new Date(data.eventDate) : null;
  if (data.eventLocation !== undefined) updateData.eventLocation = data.eventLocation;
  if (data.eventNote !== undefined) updateData.eventNote = data.eventNote;
  updateData.updatedAt = new Date();

  const [event] = await db
    .update(eventsTable)
    .set(updateData)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.userId, userId)))
    .returning();

  return event;
}

export async function completeEvent(eventId: string, userId: string) {
  const [event] = await db
    .select({ id: eventsTable.id, userId: eventsTable.userId, status: eventsTable.status })
    .from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), isNull(eventsTable.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado');
  if (event.userId !== userId) throw new ForbiddenError('No tienes permiso para modificar este evento');
  if (event.status === 'completed') throw new ValidationError('El evento ya está finalizado');

  await db
    .update(eventsTable)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.userId, userId)));

  return { success: true };
}

export async function reactivateEvent(eventId: string, userId: string) {
  const [event] = await db
    .select({ id: eventsTable.id, userId: eventsTable.userId, status: eventsTable.status, frozenAt: eventsTable.frozenAt })
    .from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), isNull(eventsTable.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado');
  if (event.userId !== userId) throw new ForbiddenError('No tienes permiso para modificar este evento');

  if (event.status === 'active' && !event.frozenAt) {
    throw new ValidationError('El evento ya está activo');
  }

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

    const [user] = await tx
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const tier = (user?.tier ?? 'free') as Tier;
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(eventsTable)
      .where(and(
        eq(eventsTable.userId, userId),
        eq(eventsTable.isActive, true),
        isNull(eventsTable.deletedAt),
        sql`${eventsTable.id} != ${eventId}`,
      ));

    const activeCount = Number(countResult?.count ?? 0);
    if (activeCount >= limits.maxEvents) {
      throw new ValidationError(`Has alcanzado el límite de ${limits.maxEvents} eventos activos en tu plan ${tier}`);
    }

    const [updated] = await tx
      .update(eventsTable)
      .set({ status: 'active', isActive: true, frozenAt: null, updatedAt: new Date() })
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.userId, userId)))
      .returning();

    return updated;
  });
}

export async function deleteEvent(eventId: string, userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(eventsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.userId, userId)));

    await tx
      .update(gifts)
      .set({ deletedAt: new Date() })
      .where(and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt)));

    await tx
      .update(photos)
      .set({ deletedAt: new Date() })
      .where(and(eq(photos.eventId, eventId), isNull(photos.deletedAt)));

    await tx
      .delete(messages)
      .where(eq(messages.eventId, eventId));

    await tx
      .delete(guests)
      .where(eq(guests.eventId, eventId));

    await tx
      .delete(eventViews)
      .where(eq(eventViews.eventId, eventId));

    const eventCashFunds = await tx
      .select({ id: cashFunds.id })
      .from(cashFunds)
      .where(eq(cashFunds.eventId, eventId));

    if (eventCashFunds.length > 0) {
      const fundIds = eventCashFunds.map(f => f.id);
      await tx
        .delete(cashContributions)
        .where(inArray(cashContributions.cashFundId, fundIds));
    }

    await tx
      .delete(cashFunds)
      .where(eq(cashFunds.eventId, eventId));

    const eventGiftIds = await tx
      .select({ id: gifts.id })
      .from(gifts)
      .where(eq(gifts.eventId, eventId));

    if (eventGiftIds.length > 0) {
      await tx
        .delete(giftClaims)
        .where(inArray(giftClaims.giftId, eventGiftIds.map(g => g.id)));
    }
  });

  return { success: true };
}

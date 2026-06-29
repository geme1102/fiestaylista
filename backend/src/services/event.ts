import { eq, and, sql, isNull, inArray, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { users, events as eventsTable, gifts, photos, cashFunds, giftClaims } from '../db/schema.js';
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
      throw new ValidationError(`Has alcanzado el límite de ${limits.maxEvents} eventos en tu plan ${tier}`);
    }

    const baseSlug = generateSlug(data.title);

    for (let attempt = 0; attempt < 10; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
      const [event] = await tx
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
        .onConflictDoNothing({ target: eventsTable.slug })
        .returning();

      if (event) return event;
    }

    throw new Error('No se pudo generar un slug único después de varios intentos');
  });
}

export async function getUserEvents(userId: string) {
  const userEvents = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.userId, userId), sql`${eventsTable.deletedAt} IS NULL`))
    .orderBy(eventsTable.createdAt);

  if (userEvents.length === 0) return [];

  const eventIds = userEvents.map(e => e.id);

  const [giftCounts, photoCounts, funds] = await Promise.all([
    db
      .select({
        eventId: gifts.eventId,
        count: sql<number>`count(*)::int`,
      })
      .from(gifts)
      .where(and(inArray(gifts.eventId, eventIds), isNull(gifts.deletedAt)))
      .groupBy(gifts.eventId),
    db
      .select({
        eventId: photos.eventId,
        count: sql<number>`count(*)::int`,
      })
      .from(photos)
      .where(and(inArray(photos.eventId, eventIds), isNull(photos.deletedAt)))
      .groupBy(photos.eventId),
    db
      .select({
        eventId: cashFunds.eventId,
        collectedAmount: cashFunds.collectedAmount,
        targetAmount: cashFunds.targetAmount,
      })
      .from(cashFunds)
      .where(inArray(cashFunds.eventId, eventIds)),
  ]);

  const giftCountMap = new Map(giftCounts.map(g => [g.eventId, g.count]));
  const photoCountMap = new Map(photoCounts.map(p => [p.eventId, p.count]));
  const fundMap = new Map(funds.map(f => [f.eventId, f]));

  return userEvents.map(event => ({
    ...event,
    giftCount: giftCountMap.get(event.id) ?? 0,
    photoCount: photoCountMap.get(event.id) ?? 0,
    cashFund: fundMap.get(event.id) ?? null,
  }));
}

export async function getEvent(eventId: string, userId: string) {
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), isNull(eventsTable.deletedAt)))
    .limit(1);

  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }

  if (event.userId !== userId) {
    throw new ForbiddenError('No tienes permiso para ver este evento');
  }

  const [eventGifts, eventPhotos, allClaims] = await Promise.all([
    db
      .select()
      .from(gifts)
      .where(and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt)))
      .orderBy(gifts.createdAt)
      .limit(101),
    db
      .select()
      .from(photos)
      .where(and(eq(photos.eventId, eventId), isNull(photos.deletedAt)))
      .orderBy(photos.createdAt)
      .limit(101),
    db
      .select()
      .from(giftClaims)
      .innerJoin(gifts, eq(giftClaims.giftId, gifts.id))
      .where(and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt)))
      .orderBy(giftClaims.createdAt),
  ]);

  const claimsByGiftId = new Map<string, Array<{ id: string; giftId: string; claimedBy: string; message: string | null; createdAt: Date }>>();
  for (const row of allClaims) {
    const id = row.gift_claims.giftId;
    if (!claimsByGiftId.has(id)) claimsByGiftId.set(id, []);
    claimsByGiftId.get(id)!.push(row.gift_claims);
  }

  return {
    ...event,
    gifts: eventGifts.map(g => ({
      ...g,
      claims: claimsByGiftId.get(g.id) || [],
    })),
    photos: eventPhotos,
  };
}

export async function updateEvent(eventId: string, userId: string, data: UpdateEventData) {
  if (data.isActive === true) {
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

      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.eventType !== undefined) updateData.eventType = data.eventType;
      if (data.hostPhone !== undefined) updateData.hostPhone = data.hostPhone;
      updateData.isActive = true;
      if (data.eventDate !== undefined) updateData.eventDate = data.eventDate ? new Date(data.eventDate) : null;
      if (data.eventLocation !== undefined) updateData.eventLocation = data.eventLocation;
      if (data.eventNote !== undefined) updateData.eventNote = data.eventNote;
      updateData.updatedAt = new Date();

      const [event] = await tx
        .update(eventsTable)
        .set(updateData)
        .where(eq(eventsTable.id, eventId))
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
    .where(eq(eventsTable.id, eventId))
    .returning();

  return event;
}

export async function getEventBySlug(eventSlug: string, giftParams: PaginationParams = {}, photoParams: PaginationParams = {}) {
  const [event] = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      eventType: eventsTable.eventType,
      slug: eventsTable.slug,
      isActive: eventsTable.isActive,
      eventDate: eventsTable.eventDate,
      eventLocation: eventsTable.eventLocation,
      eventNote: eventsTable.eventNote,
      viewCount: eventsTable.viewCount,
      hostPhone: eventsTable.hostPhone,
    })
    .from(eventsTable)
    .where(and(eq(eventsTable.slug, eventSlug), isNull(eventsTable.deletedAt)))
    .limit(1);

  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }

  if (!event.isActive) {
    throw new NotFoundError('Este evento no está disponible');
  }

  const { limit: giftLimit, cursorCondition: giftCursor } = buildPaginationConditions(
    gifts.createdAt as unknown as SQL,
    giftParams,
    50,
  );
  const giftConditions = giftCursor
    ? and(eq(gifts.eventId, event.id), isNull(gifts.deletedAt), giftCursor)
    : and(eq(gifts.eventId, event.id), isNull(gifts.deletedAt));

  const { limit: photoLimit, cursorCondition: photoCursor } = buildPaginationConditions(
    photos.createdAt as unknown as SQL,
    photoParams,
    15,
  );
  const photoConditions = photoCursor
    ? and(eq(photos.eventId, event.id), isNull(photos.deletedAt), photoCursor)
    : and(eq(photos.eventId, event.id), isNull(photos.deletedAt));

  const [eventGifts, eventPhotos] = await Promise.all([
    db
      .select()
      .from(gifts)
      .where(giftConditions)
      .orderBy(desc(gifts.createdAt))
      .limit(giftLimit),
    db
      .select()
      .from(photos)
      .where(photoConditions)
      .orderBy(desc(photos.createdAt))
      .limit(photoLimit),
  ]);

  const groupGiftIds = eventGifts.filter(g => g.isGroupGift).map(g => g.id);
  const claimsByGiftId = new Map<string, Array<{ id: string; giftId: string; claimedBy: string; message: string | null; createdAt: Date }>>();
  if (groupGiftIds.length > 0) {
    const claimRows = await db
      .select()
      .from(giftClaims)
      .where(inArray(giftClaims.giftId, groupGiftIds))
      .orderBy(giftClaims.createdAt);
    for (const row of claimRows) {
      if (!claimsByGiftId.has(row.giftId)) claimsByGiftId.set(row.giftId, []);
      claimsByGiftId.get(row.giftId)!.push(row);
    }
  }

  return {
    event,
    gifts: eventGifts.map(g => ({
      ...g,
      claims: claimsByGiftId.get(g.id) || [],
    })),
    photos: eventPhotos,
  };
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
    .where(eq(eventsTable.id, eventId));

  return { success: true };
}

export async function reactivateEvent(eventId: string, userId: string) {
  const [event] = await db
    .select({ id: eventsTable.id, userId: eventsTable.userId, status: eventsTable.status })
    .from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), isNull(eventsTable.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado');
  if (event.userId !== userId) throw new ForbiddenError('No tienes permiso para modificar este evento');
  if (event.status !== 'completed') throw new ValidationError('El evento no está finalizado');

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
        eq(eventsTable.status, 'active'),
        isNull(eventsTable.deletedAt),
      ));

    const activeCount = Number(countResult?.count ?? 0);
    if (activeCount >= limits.maxEvents) {
      throw new ValidationError(`Has alcanzado el límite de ${limits.maxEvents} eventos activos en tu plan ${tier}`);
    }

    const [updated] = await tx
      .update(eventsTable)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(eventsTable.id, eventId))
      .returning();

    return updated;
  });
}

export async function deleteEvent(eventId: string, _userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(gifts)
      .set({ deletedAt: new Date() })
      .where(and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt)));

    await tx
      .update(photos)
      .set({ deletedAt: new Date() })
      .where(and(eq(photos.eventId, eventId), isNull(photos.deletedAt)));

    await tx
      .update(eventsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eventsTable.id, eventId));
  });

  return { success: true };
}

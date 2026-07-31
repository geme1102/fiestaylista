import { eq, and, sql, isNull, inArray, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { events as eventsTable, gifts, photos, cashFunds, giftClaims } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export async function getUserEvents(userId: string) {
  const userEvents = await db
    .select({
      id: eventsTable.id,
      userId: eventsTable.userId,
      title: eventsTable.title,
      eventType: eventsTable.eventType,
      hostPhone: eventsTable.hostPhone,
      slug: eventsTable.slug,
      status: eventsTable.status,
      isActive: eventsTable.isActive,
      eventDate: eventsTable.eventDate,
      eventLocation: eventsTable.eventLocation,
      eventNote: eventsTable.eventNote,
      viewCount: eventsTable.viewCount,
      frozenAt: eventsTable.frozenAt,
      createdAt: eventsTable.createdAt,
      updatedAt: eventsTable.updatedAt,
      deletedAt: eventsTable.deletedAt,
    })
    .from(eventsTable)
    .where(and(eq(eventsTable.userId, userId), sql`${eventsTable.deletedAt} IS NULL`))
    .orderBy(eventsTable.createdAt)
    .limit(50);

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

export async function getEvent(eventId: string, userId: string, giftParams: PaginationParams = {}, photoParams: PaginationParams = {}) {
  const [event] = await db
    .select({
      id: eventsTable.id,
      userId: eventsTable.userId,
      title: eventsTable.title,
      eventType: eventsTable.eventType,
      hostPhone: eventsTable.hostPhone,
      slug: eventsTable.slug,
      status: eventsTable.status,
      isActive: eventsTable.isActive,
      eventDate: eventsTable.eventDate,
      eventLocation: eventsTable.eventLocation,
      eventNote: eventsTable.eventNote,
      viewCount: eventsTable.viewCount,
      frozenAt: eventsTable.frozenAt,
      createdAt: eventsTable.createdAt,
      updatedAt: eventsTable.updatedAt,
    })
    .from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), isNull(eventsTable.deletedAt)))
    .limit(1);

  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }

  if (event.userId !== userId) {
    throw new ForbiddenError('No tienes permiso para ver este evento');
  }

  const { limit: giftLimit } = buildPaginationConditions(
    gifts.createdAt as unknown as SQL,
    giftParams,
    50,
  );
  const { limit: photoLimit } = buildPaginationConditions(
    photos.createdAt as unknown as SQL,
    photoParams,
    50,
  );

  const [eventGifts, eventPhotos, allClaims] = await Promise.all([
    db
      .select()
      .from(gifts)
      .where(and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt)))
      .orderBy(desc(gifts.createdAt))
      .limit(giftLimit),
    db
      .select()
      .from(photos)
      .where(and(eq(photos.eventId, eventId), isNull(photos.deletedAt)))
      .orderBy(desc(photos.createdAt))
      .limit(photoLimit),
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

export async function getEventBySlug(eventSlug: string, giftParams: PaginationParams = {}, photoParams: PaginationParams = {}) {
  // El campo `id` (UUID v4 aleatorio) se expone públicamente porque el frontend lo necesita
  // para llamadas API posteriores (gifts, photos, messages, rsvp). Es seguro: los UUID v4
  // no son secuenciales ni enumerables, y las rutas de admin validan ownership con req.user.
  const [event] = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      eventType: eventsTable.eventType,
      slug: eventsTable.slug,
      status: eventsTable.status,
      isActive: eventsTable.isActive,
      eventDate: eventsTable.eventDate,
      eventLocation: eventsTable.eventLocation,
      eventNote: eventsTable.eventNote,
      viewCount: eventsTable.viewCount,
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

import { eq, and, sql, isNull, inArray, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { events as eventsTable, gifts, photos, cashFunds, giftClaims, users } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { EventType } from '../types/index.js';

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
    .orderBy(desc(eventsTable.createdAt))
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

  return userEvents.map(e => ({
    id: e.id,
    userId: e.userId,
    title: e.title,
    eventType: e.eventType as EventType,
    hostPhone: e.hostPhone ?? undefined,
    slug: e.slug,
    status: e.status,
    isActive: e.isActive,
    eventDate: e.eventDate ? e.eventDate.toISOString() : null,
    eventLocation: e.eventLocation,
    eventNote: e.eventNote,
    viewCount: e.viewCount,
    frozenAt: e.frozenAt ? e.frozenAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    giftCount: giftCountMap.get(e.id) ?? 0,
    photoCount: photoCountMap.get(e.id) ?? 0,
    cashFund: fundMap.get(e.id) ?? null,
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

  const { limit: giftLimit, cursorCondition: giftCursor } = buildPaginationConditions(
    gifts.createdAt as unknown as SQL,
    giftParams,
    50,
  );
  const giftConditions = giftCursor
    ? and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt), giftCursor)
    : and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt));

  const { limit: photoLimit, cursorCondition: photoCursor } = buildPaginationConditions(
    photos.createdAt as unknown as SQL,
    photoParams,
    50,
  );
  const photoConditions = photoCursor
    ? and(eq(photos.eventId, eventId), isNull(photos.deletedAt), photoCursor)
    : and(eq(photos.eventId, eventId), isNull(photos.deletedAt));

  // B9: los claims se cargan SOLO de los gifts de la página actual (IN de ids).
  // Antes se cargaban TODOS los claims del evento (innerJoin sin limit): con
  // muchos regalos apartados, /api/events/:id volvía lento y pesado
  // innecesariamente. Los claims de páginas siguientes se cargan con su cursor.
  const eventGifts = await db
    .select()
    .from(gifts)
    .where(giftConditions)
    .orderBy(desc(gifts.createdAt))
    .limit(giftLimit);

  const [eventPhotos, claimRows] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(photoConditions)
      .orderBy(desc(photos.createdAt))
      .limit(photoLimit),
    eventGifts.length > 0
      ? db
          .select()
          .from(giftClaims)
          .where(inArray(giftClaims.giftId, eventGifts.map(g => g.id)))
          .orderBy(giftClaims.createdAt)
      : Promise.resolve([] as typeof giftClaims.$inferSelect[]),
  ]);

  const claimsByGiftId = new Map<string, Array<{ id: string; giftId: string; claimedBy: string; message: string | null; createdAt: Date }>>();
  for (const row of claimRows) {
    const id = row.giftId;
    if (!claimsByGiftId.has(id)) claimsByGiftId.set(id, []);
    claimsByGiftId.get(id)!.push(row);
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
      // ownerTier: expone el plan del dueño (free/pro/pro_plus) para que el
      // frontend oculte la UI de fotos en eventos free — requisito de negocio:
      // FREE no sube ni comparte fotos.
      ownerTier: users.tier,
    })
    .from(eventsTable)
    .innerJoin(users, eq(users.id, eventsTable.userId))
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

  // MEDIUM-1: el dueño free (downgrade) NO comparte fotos — se ocultan de la
  // vista pública (galería y og:image) sin borrarlas: si reactiva Pro vuelven.
  const isFreeEvent = (event.ownerTier ?? 'free') === 'free';

  const [eventGifts, eventPhotos] = await Promise.all([
    db
      .select()
      .from(gifts)
      .where(giftConditions)
      .orderBy(desc(gifts.createdAt))
      .limit(giftLimit),
    isFreeEvent
      ? Promise.resolve([])
      : db
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

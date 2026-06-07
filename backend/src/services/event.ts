import { eq, and, sql, isNull, inArray, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { events as eventsTable, gifts, photos, cashFunds } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { generateSlug } from '../utils/slug.js';
import type { EventType } from '../types/index.js';

interface CreateEventData {
  title: string;
  eventType: EventType;
  hostPhone?: string;
}

interface UpdateEventData {
  title?: string;
  eventType?: EventType;
  hostPhone?: string;
  isActive?: boolean;
}

async function verifyOwnership(eventId: string, userId: string) {
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId))
    .limit(1);

  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }

  if (event.userId !== userId) {
    throw new ForbiddenError('No tienes permiso para modificar este evento');
  }

  return event;
}

export async function createEvent(userId: string, data: CreateEventData) {
  const baseSlug = generateSlug(data.title);

  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const [event] = await db
      .insert(eventsTable)
      .values({
        userId,
        title: data.title,
        eventType: data.eventType,
        hostPhone: data.hostPhone || null,
        slug,
      })
      .onConflictDoNothing({ target: eventsTable.slug })
      .returning();

    if (event) return event;
  }

  throw new Error('No se pudo generar un slug único después de varios intentos');
}

export async function getUserEvents(userId: string) {
  const userEvents = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.userId, userId), sql`${eventsTable.deletedAt} IS NULL`))
    .orderBy(eventsTable.createdAt);

  if (userEvents.length === 0) return [];

  const eventIds = userEvents.map(e => e.id);

  // const { inArray } = await import('drizzle-orm');

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
      .where(inArray(photos.eventId, eventIds))
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
    .where(eq(eventsTable.id, eventId))
    .limit(1);

  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }

  if (event.userId !== userId) {
    throw new ForbiddenError('No tienes permiso para ver este evento');
  }

  const eventGifts = await db
    .select()
    .from(gifts)
    .where(and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt)))
    .orderBy(gifts.createdAt);

  const eventPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.eventId, eventId))
    .orderBy(photos.createdAt);

  return {
    ...event,
    gifts: eventGifts,
    photos: eventPhotos,
  };
}

export async function updateEvent(eventId: string, userId: string, data: UpdateEventData) {
  await verifyOwnership(eventId, userId);

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.eventType !== undefined) updateData.eventType = data.eventType;
  if (data.hostPhone !== undefined) updateData.hostPhone = data.hostPhone;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
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
      hostPhone: eventsTable.hostPhone,
      boostedUntil: eventsTable.boostedUntil,
      createdAt: eventsTable.createdAt,
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
    gifts.createdAt,
    giftParams,
    50,
  );
  const giftConditions = giftCursor
    ? and(eq(gifts.eventId, event.id), isNull(gifts.deletedAt), giftCursor)
    : and(eq(gifts.eventId, event.id), isNull(gifts.deletedAt));

  const eventGifts = await db
    .select()
    .from(gifts)
    .where(giftConditions)
    .orderBy(desc(gifts.createdAt))
    .limit(giftLimit);

  const { limit: photoLimit, cursorCondition: photoCursor } = buildPaginationConditions(
    photos.createdAt as unknown as SQL,
    photoParams,
    15,
  );
  const photoConditions = photoCursor
    ? and(eq(photos.eventId, event.id), photoCursor)
    : eq(photos.eventId, event.id);

  const eventPhotos = await db
    .select()
    .from(photos)
    .where(photoConditions)
    .orderBy(desc(photos.createdAt))
    .limit(photoLimit);

  return {
    event,
    gifts: eventGifts,
    photos: eventPhotos,
  };
}

export async function deleteEvent(eventId: string, userId: string) {
  await verifyOwnership(eventId, userId);

  await db
    .update(eventsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(eventsTable.id, eventId));

  return { success: true };
}

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events as eventsTable, gifts, photos, cashFunds } from '../db/schema.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { generateSlug, generateUniqueSlug } from '../utils/slug.js';
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

  const existing = await db
    .select({ slug: eventsTable.slug })
    .from(eventsTable)
    .where(sql`${eventsTable.slug} LIKE ${`${baseSlug}%`}`)
    .limit(50);

  const existingSlugs = new Set(existing.map((e) => e.slug));
  const slug = generateUniqueSlug(baseSlug, existingSlugs);

  const [event] = await db
    .insert(eventsTable)
    .values({
      userId,
      title: data.title,
      eventType: data.eventType,
      hostPhone: data.hostPhone || null,
      slug,
    })
    .returning();

  return event;
}

export async function getUserEvents(userId: string) {
  const userEvents = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.userId, userId))
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
      .where(sql`${gifts.eventId} = ANY(${eventIds}::uuid[])`)
      .groupBy(gifts.eventId),
    db
      .select({
        eventId: photos.eventId,
        count: sql<number>`count(*)::int`,
      })
      .from(photos)
      .where(sql`${photos.eventId} = ANY(${eventIds}::uuid[])`)
      .groupBy(photos.eventId),
    db
      .select({
        eventId: cashFunds.eventId,
        collectedAmount: cashFunds.collectedAmount,
        targetAmount: cashFunds.targetAmount,
      })
      .from(cashFunds)
      .where(sql`${cashFunds.eventId} = ANY(${eventIds}::uuid[])`),
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

export async function getEvent(eventId: string, _userId?: string) {
  void _userId;
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId))
    .limit(1);

  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }

  const eventGifts = await db
    .select()
    .from(gifts)
    .where(eq(gifts.eventId, eventId))
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
  updateData.updatedAt = new Date();

  const [event] = await db
    .update(eventsTable)
    .set(updateData)
    .where(eq(eventsTable.id, eventId))
    .returning();

  return event;
}

export async function getEventBySlug(eventSlug: string) {
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.slug, eventSlug), sql`${eventsTable.deletedAt} IS NULL`))
    .limit(1);

  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }

  if (!event.isActive) {
    throw new NotFoundError('Este evento no está disponible');
  }

  const eventGifts = await db
    .select()
    .from(gifts)
    .where(eq(gifts.eventId, event.id))
    .orderBy(gifts.createdAt);

  const eventPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .orderBy(photos.createdAt);

  return {
    event,
    gifts: eventGifts,
    photos: eventPhotos,
  };
}

export async function deleteEvent(eventId: string, userId: string) {
  await verifyOwnership(eventId, userId);

  await db
    .delete(eventsTable)
    .where(eq(eventsTable.id, eventId));

  return { success: true };
}

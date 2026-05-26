import { eq, sql } from 'drizzle-orm';
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

  const eventsWithCounts = await Promise.all(
    userEvents.map(async (event) => {
      const [giftCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(gifts)
        .where(eq(gifts.eventId, event.id));

      const [photoCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(photos)
        .where(eq(photos.eventId, event.id));

      const [fund] = await db
        .select({ collectedAmount: cashFunds.collectedAmount, targetAmount: cashFunds.targetAmount })
        .from(cashFunds)
        .where(eq(cashFunds.eventId, event.id))
        .limit(1);

      return {
        ...event,
        giftCount: Number(giftCount?.count ?? 0),
        photoCount: Number(photoCount?.count ?? 0),
        cashFund: fund || null,
      };
    }),
  );

  return eventsWithCounts;
}

export async function getEvent(eventId: string, userId?: string) {
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
    .where(eq(eventsTable.slug, eventSlug))
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

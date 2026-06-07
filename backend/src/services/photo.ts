import { eq, sql } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../db/index.js';
import { photos as photosTable, events, users } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { TIER_LIMITS, type Tier } from '../types/index.js';

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function addPhoto(eventId: string, url: string, caption?: string) {
  if (!isValidImageUrl(url)) {
    throw new ValidationError('La URL de la foto no es válida');
  }

  return await db.transaction(async (tx) => {
    const [event] = await tx
      .select({ userId: events.userId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) throw new NotFoundError('Evento no encontrado');

    const [user] = await tx
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, event.userId))
      .limit(1);

    const tier = (user?.tier as Tier) || 'free';
    const limits = TIER_LIMITS[tier];

    if (limits) {
      const [countResult] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(photosTable)
        .where(eq(photosTable.eventId, eventId));

      const photoCount = Number(countResult?.count ?? 0);
      if (photoCount >= limits.maxPhotosPerEvent) {
        throw new ValidationError(`Has alcanzado el límite de ${limits.maxPhotosPerEvent} fotos por evento en tu plan ${tier}`);
      }
    }

    const [photo] = await tx
      .insert(photosTable)
      .values({
        eventId,
        url,
        caption: caption || null,
      })
      .returning();

    return photo;
  });
}

export async function deletePhoto(photoId: string) {
  const [photo] = await db
    .delete(photosTable)
    .where(eq(photosTable.id, photoId))
    .returning();

  if (!photo) {
    throw new NotFoundError('Foto no encontrada');
  }

  if (photo.url.includes('cloudinary.com')) {
    try {
      const publicId = photo.url
        .split('/')
        .slice(-2)
        .join('/')
        .replace(/\.[^.]+$/, '');
      await Promise.race([
        cloudinary.uploader.destroy(publicId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Cloudinary request timed out')), 10000),
        ),
      ]);
    } catch (err) {
      console.error('[Photo] Error al eliminar de Cloudinary:', err);
    }
  }

  return { success: true };
}

export async function getEventPhotos(eventId: string) {
  const eventPhotos = await db
    .select()
    .from(photosTable)
    .where(eq(photosTable.eventId, eventId))
    .orderBy(photosTable.createdAt);

  return eventPhotos;
}

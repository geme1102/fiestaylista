import { eq, and, isNull, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { isIP } from 'node:net';
import { db } from '../db/index.js';
import { photos as photosTable, events, users } from '../db/schema.js';
import { sanitizeAndStrip } from '../utils/sanitize.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { getPublicIdFromUrl, isOwnCloudinaryUrl, destroyWithRetry } from '../utils/cloudinary.js';
import { TIER_LIMITS, type Tier } from '../types/index.js';
import { ensureEventNotFrozen } from './event.js';

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '0.0.0.0' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return true;
  }
  if (isIP(lower)) {
    const parts = lower.split('.').map(Number);
    if (parts.length === 4) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 127) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    }
  }
  return false;
}

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (isPrivateHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function addPhoto(eventId: string, url: string, caption?: string) {
  if (!isValidImageUrl(url)) {
    throw new ValidationError('La URL de la foto no es válida');
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId})::bigint)`);

      const [event] = await tx
        .select({ userId: events.userId, isActive: events.isActive, frozenAt: events.frozenAt })
        .from(events)
        .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
        .limit(1);

      if (!event) throw new NotFoundError('Evento no encontrado');
      if (event.frozenAt) throw new ValidationError('Este evento está congelado. Reactívalo desde la configuración.');
      if (!event.isActive) throw new ValidationError('Este evento no está activo');

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
          .where(and(eq(photosTable.eventId, eventId), isNull(photosTable.deletedAt)));

        const photoCount = Number(countResult?.count ?? 0);
        if (photoCount >= limits.maxPhotosPerEvent) {
          if (limits.maxPhotosPerEvent === 0) {
            throw new ValidationError('Tu plan no incluye fotos. Mejora tu plan para subir fotos al evento.');
          }
          throw new ValidationError(`Has alcanzado el límite de ${limits.maxPhotosPerEvent} fotos por evento en tu plan ${tier}`);
        }
      }

      const [photo] = await tx
        .insert(photosTable)
        .values({
          eventId,
          url,
          caption: caption ? sanitizeAndStrip(caption) : null,
        })
        .returning();

      return photo;
    });
  } catch (err) {
    const publicId = getPublicIdFromUrl(url);
    if (publicId && isOwnCloudinaryUrl(url)) {
      destroyWithRetry(publicId, { timeout: 5000 });
    }
    throw err;
  }
}

export async function deletePhoto(photoId: string) {
  const [photoMeta] = await db
    .select({ eventId: photosTable.eventId })
    .from(photosTable)
    .where(eq(photosTable.id, photoId))
    .limit(1);
  if (photoMeta) await ensureEventNotFrozen(photoMeta.eventId);

  const [photo] = await db
    .update(photosTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(photosTable.id, photoId), isNull(photosTable.deletedAt)))
    .returning();

  if (!photo) {
    throw new NotFoundError('Foto no encontrada');
  }

  const publicId = getPublicIdFromUrl(photo.url);
  if (publicId && isOwnCloudinaryUrl(photo.url)) {
    await destroyWithRetry(publicId);
  }

  return { success: true };
}

export async function toggleFeaturedPhoto(photoId: string) {
  const [photoMeta] = await db
    .select({ eventId: photosTable.eventId })
    .from(photosTable)
    .where(eq(photosTable.id, photoId))
    .limit(1);
  if (photoMeta) await ensureEventNotFrozen(photoMeta.eventId);

  const [updated] = await db
    .update(photosTable)
    .set({ isFeatured: sql`NOT ${photosTable.isFeatured}` })
    .where(and(eq(photosTable.id, photoId), isNull(photosTable.deletedAt)))
    .returning();

  if (!updated) throw new NotFoundError('Foto no encontrada');
  return updated;
}

export async function getEventPhotos(eventId: string, params: PaginationParams = {}) {
  const { limit, cursorCondition } = buildPaginationConditions(
    photosTable.createdAt as unknown as SQL,
    params,
    50,
  );
  const conditions = cursorCondition
    ? and(eq(photosTable.eventId, eventId), isNull(photosTable.deletedAt), cursorCondition)
    : and(eq(photosTable.eventId, eventId), isNull(photosTable.deletedAt));

  const eventPhotos = await db
    .select({
      id: photosTable.id,
      eventId: photosTable.eventId,
      url: photosTable.url,
      caption: photosTable.caption,
      isFeatured: photosTable.isFeatured,
      createdAt: photosTable.createdAt,
    })
    .from(photosTable)
    .where(conditions)
    .orderBy(desc(photosTable.createdAt))
    .limit(limit + 1);

  const hasMore = eventPhotos.length > limit;
  return { photos: hasMore ? eventPhotos.slice(0, limit) : eventPhotos, hasMore };
}

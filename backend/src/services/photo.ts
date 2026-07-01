import { eq, and, isNull, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { v2 as cloudinary } from 'cloudinary';
import { isIP } from 'node:net';
import { db } from '../db/index.js';
import { photos as photosTable, events, users } from '../db/schema.js';
import { sanitizeAndStrip } from '../utils/sanitize.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { getPublicIdFromUrl } from '../utils/cloudinary.js';
import { TIER_LIMITS, type Tier } from '../types/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Photo');

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
        .select({ userId: events.userId, isActive: events.isActive })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (!event) throw new NotFoundError('Evento no encontrado');
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
    if (publicId) {
      cloudinary.uploader.destroy(publicId).catch(() => {});
    }
    throw err;
  }
}

export async function deletePhoto(photoId: string) {
  const [photo] = await db
    .update(photosTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(photosTable.id, photoId), isNull(photosTable.deletedAt)))
    .returning();

  if (!photo) {
    throw new NotFoundError('Foto no encontrada');
  }

  const publicId = getPublicIdFromUrl(photo.url);
  if (publicId) {
    try {
      await Promise.race([
        cloudinary.uploader.destroy(publicId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Cloudinary request timed out')), 10000),
        ),
      ]);
    } catch (err) {
      log.error({ err }, 'Error al eliminar de Cloudinary:');
    }
  }

  return { success: true };
}

export async function toggleFeaturedPhoto(photoId: string) {
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
    .select()
    .from(photosTable)
    .where(conditions)
    .orderBy(desc(photosTable.createdAt))
    .limit(limit);

  return eventPhotos;
}

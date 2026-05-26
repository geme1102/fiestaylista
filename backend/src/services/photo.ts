import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { photos as photosTable } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';

export async function addPhoto(eventId: string, url: string, caption?: string) {
  const [photo] = await db
    .insert(photosTable)
    .values({
      eventId,
      url,
      caption: caption || null,
    })
    .returning();

  return photo;
}

export async function deletePhoto(photoId: string) {
  const [photo] = await db
    .delete(photosTable)
    .where(eq(photosTable.id, photoId))
    .returning();

  if (!photo) {
    throw new NotFoundError('Foto no encontrada');
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

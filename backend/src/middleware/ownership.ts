import type { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, gifts, photos } from '../db/schema.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';

export async function requireEventOwnership(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawParams = req.params;
    const rawId: string | undefined = typeof rawParams.eventId === 'string' ? rawParams.eventId : typeof rawParams.id === 'string' ? rawParams.id : undefined;
    const userId: string | undefined = req.user?.userId;

    if (!rawId) {
      next(new NotFoundError('ID del evento requerido'));
      return;
    }
    if (!userId) {
      next(new ForbiddenError('Acceso denegado'));
      return;
    }

    const [event] = await db
      .select({ ownerId: events.userId })
      .from(events)
      .where(eq(events.id, rawId))
      .limit(1);

    if (!event) {
      next(new NotFoundError('Evento no encontrado'));
      return;
    }
    if (event.ownerId !== userId) {
      next(new ForbiddenError('No tienes permiso para modificar este evento'));
      return;
    }

    if (rawParams.giftId) {
      const [gift] = await db
        .select({ eventId: gifts.eventId })
        .from(gifts)
        .where(eq(gifts.id, rawParams.giftId))
        .limit(1);
      if (!gift || gift.eventId !== rawId) {
        next(new ForbiddenError('El regalo no pertenece a este evento'));
        return;
      }
    }

    if (rawParams.photoId) {
      const [photo] = await db
        .select({ eventId: photos.eventId })
        .from(photos)
        .where(eq(photos.id, rawParams.photoId))
        .limit(1);
      if (!photo || photo.eventId !== rawId) {
        next(new ForbiddenError('La foto no pertenece a este evento'));
        return;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

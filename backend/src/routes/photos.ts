import { Router } from 'express';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import * as photoService from '../services/photo.js';
import { emitPhotoUploaded } from '../services/notifications.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';

const router = Router({ mergeParams: true });

const createPhotoSchema = z.object({
  url: z.string().url('La URL de la foto es inválida').refine((u) => {
    try { const p = new URL(u); return p.protocol === 'https:'; } catch { return false; }
  }, 'La URL debe ser una imagen HTTPS válida'),
  caption: z.string().max(500, 'El pie de foto es demasiado largo').optional(),
});

router.get('/', apiLimiter, validateUuidParam('eventId'), asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const photos = await photoService.getEventPhotos(eventId, {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: req.query.cursor as string | undefined,
  });
  res.json({ photos, hasMore: photos.length === Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 200) });
}));

router.post('/', requireAuth, requireEventOwnership, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }

  const data = createPhotoSchema.parse(req.body);
  const photo = await photoService.addPhoto(eventId, data.url, data.caption);

  emitPhotoUploaded({
    eventId,
    photoUrl: data.url,
    uploadedBy: 'El anfitrión',
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ photo });
}));

const guestPhotoSchema = z.object({
  url: z.string().url('La URL de la foto es inválida').refine((u) => {
    try { const p = new URL(u); return p.protocol === 'https:'; } catch { return false; }
  }, 'La URL debe ser una imagen HTTPS válida'),
  caption: z.string().max(500).optional(),
});

router.post('/guest-upload', apiLimiter, verifyTurnstile, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.isActive, true), isNull(events.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado o inactivo');

  const data = guestPhotoSchema.parse(req.body);
  const photo = await photoService.addPhoto(eventId, data.url, data.caption);

  emitPhotoUploaded({
    eventId,
    photoUrl: data.url,
    uploadedBy: data.caption || 'Un invitado',
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ photo });
}));

router.delete('/:photoId', requireAuth, requireEventOwnership, validateUuidParam('eventId'), validateUuidParam('photoId'), asyncHandler(async (req: AuthRequest, res) => {
  const photoId = req.params.photoId as string | undefined;
  if (!photoId) {
    throw new ValidationError('ID de la foto requerido');
  }
  const result = await photoService.deletePhoto(photoId);
  res.json(result);
}));

router.put('/:photoId/feature', requireAuth, requireEventOwnership, validateUuidParam('eventId'), validateUuidParam('photoId'), asyncHandler(async (req: AuthRequest, res) => {
  const photoId = req.params.photoId as string | undefined;
  if (!photoId) throw new ValidationError('ID de la foto requerido');
  const photo = await photoService.toggleFeaturedPhoto(photoId);
  res.json({ photo });
}));

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { guestUploadLimiter, apiLimiter } from '../middleware/rateLimit.js';
import * as photoService from '../services/photo.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';

const router = Router({ mergeParams: true });

const createPhotoSchema = z.object({
  url: z.string().url('La URL de la foto es inválida').refine((u) => {
    try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:'; } catch { return false; }
  }, 'La URL debe ser una imagen HTTPS válida'),
  caption: z.string().max(500, 'El pie de foto es demasiado largo').optional(),
});

router.get('/', apiLimiter, asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const photos = await photoService.getEventPhotos(eventId);
  res.json({ photos });
}));

router.post('/', requireAuth, requireEventOwnership, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }

  const data = createPhotoSchema.parse(req.body);
  const photo = await photoService.addPhoto(eventId, data.url, data.caption);
  res.status(201).json({ photo });
}));

router.post('/guest', guestUploadLimiter, asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const data = createPhotoSchema.parse(req.body);
  const photo = await photoService.addPhoto(eventId, data.url, data.caption);
  res.status(201).json({ photo });
}));

router.delete('/:photoId', requireAuth, requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const photoId = req.params.photoId as string | undefined;
  if (!photoId) {
    throw new ValidationError('ID de la foto requerido');
  }
  const result = await photoService.deletePhoto(photoId);
  res.json(result);
}));

export default router;

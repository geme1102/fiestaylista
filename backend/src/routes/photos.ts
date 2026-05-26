import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import * as photoService from '../services/photo.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';

const router = Router({ mergeParams: true });

const createPhotoSchema = z.object({
  url: z.string().url('La URL de la foto es inválida'),
  caption: z.string().max(500, 'El pie de foto es demasiado largo').optional(),
});

router.get('/', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId as string | undefined;
    if (!eventId) {
      throw new ValidationError('ID del evento requerido');
    }
    const photos = await photoService.getEventPhotos(eventId);
    res.json({ photos });
  } catch (error) {
    next(error);
  }
}) as any);

router.post('/', requireAuth, requireEventOwnership, (async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId as string | undefined;
    if (!eventId) {
      throw new ValidationError('ID del evento requerido');
    }

    const data = createPhotoSchema.parse(req.body);
    const photo = await photoService.addPhoto(eventId, data.url, data.caption);
    res.status(201).json({ photo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
}) as any);

router.delete('/:photoId', requireAuth, requireEventOwnership, (async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const photoId = req.params.photoId as string | undefined;
    if (!photoId) {
      throw new ValidationError('ID de la foto requerido');
    }
    const result = await photoService.deletePhoto(photoId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}) as any);

export default router;

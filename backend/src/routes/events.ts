import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { checkEventLimit } from '../middleware/subscription.js';
import * as eventService from '../services/event.js';
import { ValidationError } from '../utils/errors.js';
import { EVENT_TYPES } from '../types/index.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const createEventSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200, 'El título es demasiado largo'),
  eventType: z.enum(EVENT_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'Tipo de evento inválido' }),
  }),
  hostPhone: z.string().optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  eventType: z.enum(EVENT_TYPES as [string, ...string[]]).optional(),
  hostPhone: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const events = await eventService.getUserEvents(req.user!.userId);
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, checkEventLimit(), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createEventSchema.parse(req.body);
    const data = parsed as { title: string; eventType: 'BABY_SHOWER' | 'WEDDING' | 'BIRTHDAY' | 'BAPTISM' | 'COMMUNION' | 'OTHER' | 'HOUSE_WARMING'; hostPhone?: string };
    const event = await eventService.createEvent(req.user!.userId, data);
    res.status(201).json({ event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.get('/slug/:slug', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventSlug = req.params.slug as string;
    const result = await eventService.getEventBySlug(eventSlug);
    res.json(result);
  } catch (error) {
    console.error(`[Events] Error al cargar evento por slug "${req.params.slug}":`, error);
    next(error);
  }
}) as any);

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const eventId = req.params.id as string;
    const result = await eventService.getEvent(eventId, req.user!.userId);
    res.json({ event: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, requireEventOwnership, async (req: AuthRequest, res, next) => {
  try {
    const data = updateEventSchema.parse(req.body) as { title?: string; eventType?: 'BABY_SHOWER' | 'WEDDING' | 'BIRTHDAY' | 'BAPTISM' | 'COMMUNION' | 'OTHER' | 'HOUSE_WARMING'; hostPhone?: string };
    const event = await eventService.updateEvent(req.params.id as string, req.user!.userId, data);
    res.json({ event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.delete('/:id', requireAuth, requireEventOwnership, async (req: AuthRequest, res, next) => {
  try {
    const result = await eventService.deleteEvent(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

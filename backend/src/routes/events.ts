import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { checkEventLimit } from '../middleware/subscription.js';
import * as eventService from '../services/event.js';
import type { CreateEventData, UpdateEventData } from '../services/event.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
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

router.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const events = await eventService.getUserEvents(req.user!.userId);
  res.json({ events });
}));

router.post('/', requireAuth, checkEventLimit(), asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = createEventSchema.parse(req.body) as CreateEventData;
  const event = await eventService.createEvent(req.user!.userId, data);
  res.status(201).json({ event });
}));

router.get('/slug/:slug', asyncHandler(async (req, res) => {
  const eventSlug = req.params.slug as string;
  const result = await eventService.getEventBySlug(eventSlug, {
    limit: req.query.giftLimit ? Number(req.query.giftLimit) : undefined,
    cursor: req.query.giftCursor as string | undefined,
  }, {
    limit: req.query.photoLimit ? Number(req.query.photoLimit) : undefined,
    cursor: req.query.photoCursor as string | undefined,
  });
  res.json(result);
}));

router.get('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.id as string;
  const result = await eventService.getEvent(eventId, req.user!.userId);
  res.json({ event: result });
}));

router.put('/:id', requireAuth, requireEventOwnership, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = updateEventSchema.parse(req.body) as UpdateEventData;
  const event = await eventService.updateEvent(req.params.id as string, req.user!.userId, data);
  res.json({ event });
}));

router.delete('/:id', requireAuth, requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const result = await eventService.deleteEvent(req.params.id as string, req.user!.userId);
  res.json(result);
}));

export default router;

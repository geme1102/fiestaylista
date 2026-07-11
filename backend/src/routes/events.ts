import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireEmailVerified } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { checkActiveEventLimit } from '../middleware/subscription.js';
import * as eventService from '../services/event.js';
import * as eventQueries from '../services/event-queries.js';
import type { CreateEventData, UpdateEventData } from '../services/event.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { sanitizeAndStrip } from '../utils/sanitize.js';
import { EVENT_TYPES } from '../types/index.js';
import type { AuthRequest } from '../types/index.js';
import { createEventLimiter, viewLimiter } from '../middleware/rateLimit.js';
import { validateUuidParam } from '../middleware/validateUuid.js';

const router = Router();

function normalizePhone(v: unknown) {
  return typeof v === 'string' ? v.replace(/[\s\-()]/g, '') : v;
}

const phoneRegex = /^\+?\d{7,15}$/;

const createEventSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200, 'El título es demasiado largo').transform(sanitizeAndStrip),
  eventType: z.enum(EVENT_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'Tipo de evento inválido' }),
  }),
  hostPhone: z.preprocess(normalizePhone, z.string().regex(phoneRegex, 'Teléfono inválido')).optional(),
  eventDate: z.string().datetime({ offset: true }).optional(),
  eventLocation: z.string().max(200).optional().transform(v => sanitizeAndStrip(v || '')),
  eventNote: z.string().max(1000).optional().transform(v => sanitizeAndStrip(v || '')),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional().transform(v => v ? sanitizeAndStrip(v) : undefined),
  eventType: z.enum(EVENT_TYPES as [string, ...string[]]).optional(),
  hostPhone: z.preprocess(normalizePhone, z.string().regex(phoneRegex, 'Teléfono inválido')).optional(),
  isActive: z.boolean().optional(),
  eventDate: z.string().datetime({ offset: true }).nullable().optional(),
  eventLocation: z.string().max(200).nullable().optional().transform(v => v ? sanitizeAndStrip(v) : undefined),
  eventNote: z.string().max(1000).nullable().optional().transform(v => v ? sanitizeAndStrip(v) : undefined),
});

router.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const events = await eventQueries.getUserEvents(req.user!.userId);
  res.json({ events });
}));

router.post('/', requireAuth, requireEmailVerified, createEventLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = createEventSchema.parse(req.body) as CreateEventData;
  const event = await eventService.createEvent(req.user!.userId, data);
  res.status(201).json({ event });
}));

router.get('/slug/:slug', viewLimiter, (_req, res, next) => { res.set('Cache-Control', 'public, max-age=60, s-maxage=120'); next(); }, asyncHandler(async (req, res) => {
  const eventSlug = req.params.slug as string;
  const result = await eventQueries.getEventBySlug(eventSlug, {
    limit: req.query.giftLimit ? Number(req.query.giftLimit) : undefined,
    cursor: req.query.giftCursor as string | undefined,
  }, {
    limit: req.query.photoLimit ? Number(req.query.photoLimit) : undefined,
    cursor: req.query.photoCursor as string | undefined,
  });
  res.json(result);
}));

router.get('/:id', requireAuth, validateUuidParam('id'), asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.id as string;
  const result = await eventQueries.getEvent(eventId, req.user!.userId, {
    limit: req.query.giftLimit ? Number(req.query.giftLimit) : undefined,
    cursor: req.query.giftCursor as string | undefined,
  }, {
    limit: req.query.photoLimit ? Number(req.query.photoLimit) : undefined,
    cursor: req.query.photoCursor as string | undefined,
  });
  res.json({ event: result });
}));

router.put('/:id', requireAuth, requireEventOwnership, validateUuidParam('id'), checkActiveEventLimit(), asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = updateEventSchema.parse(req.body) as UpdateEventData;
  const event = await eventService.updateEvent(req.params.id as string, req.user!.userId, data);
  res.json({ event });
}));

router.delete('/:id', requireAuth, requireEmailVerified, requireEventOwnership, validateUuidParam('id'), asyncHandler(async (req: AuthRequest, res) => {
  const result = await eventService.deleteEvent(req.params.id as string, req.user!.userId);
  res.json(result);
}));

router.post('/:id/complete', requireAuth, requireEventOwnership, validateUuidParam('id'), asyncHandler(async (req: AuthRequest, res) => {
  const result = await eventService.completeEvent(req.params.id as string, req.user!.userId);
  res.json(result);
}));

router.post('/:id/reactivate', requireAuth, requireEventOwnership, validateUuidParam('id'), asyncHandler(async (req: AuthRequest, res) => {
  const event = await eventService.reactivateEvent(req.params.id as string, req.user!.userId);
  res.json({ event });
}));

export default router;

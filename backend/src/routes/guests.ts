import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, isNull } from 'drizzle-orm';

import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { sanitizeAndStrip } from '../utils/sanitize.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { guests, events } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { rsvpLimiter } from '../middleware/rateLimit.js';

const router = Router();

const rsvpSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  companions: z.number().int().min(0).max(10).default(0),
  dietaryRestrictions: z.string().max(500).optional().or(z.literal('')),
  message: z.string().max(500).optional().or(z.literal('')),
});

router.get('/events/:eventId/guests', requireAuth, requireEventOwnership, validateUuidParam('eventId'), asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 200);

  const eventGuests = await db
    .select({
      id: guests.id,
      eventId: guests.eventId,
      name: guests.name,
      email: guests.email,
      phone: guests.phone,
      isConfirmed: guests.isConfirmed,
      companions: guests.companions,
      dietaryRestrictions: guests.dietaryRestrictions,
      message: guests.message,
      createdAt: guests.createdAt,
    })
    .from(guests)
    .where(eq(guests.eventId, eventId))
    .orderBy(desc(guests.createdAt))
    .limit(limit + 1);

  const hasMore = eventGuests.length > limit;
  res.json({ guests: hasMore ? eventGuests.slice(0, limit) : eventGuests, hasMore });
}));

router.post('/events/:eventId/rsvp', rsvpLimiter, verifyTurnstile, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const data = rsvpSchema.parse(req.body);

  const [evt] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.status, 'active'), eq(events.isActive, true), isNull(events.deletedAt)))
    .limit(1);

  if (!evt) throw new NotFoundError('Evento no encontrado o inactivo');

  const [guest] = await db
    .insert(guests)
    .values({
      eventId,
      name: sanitizeAndStrip(data.name),
      email: data.email ? sanitizeAndStrip(data.email) : null,
      phone: data.phone ? sanitizeAndStrip(data.phone) : null,
      companions: data.companions,
      dietaryRestrictions: data.dietaryRestrictions ? sanitizeAndStrip(data.dietaryRestrictions) : null,
      message: data.message ? sanitizeAndStrip(data.message) : null,
      isConfirmed: true,
    })
    .returning();

  res.status(201).json({ guest });
}));

export default router;

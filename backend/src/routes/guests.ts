import { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';

import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { guests } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { verifyTurnstileOptional } from '../middleware/turnstile.js';

const router = Router();

const rsvpSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  companions: z.number().int().min(0).max(50).default(0),
  dietaryRestrictions: z.string().max(500).optional().or(z.literal('')),
  message: z.string().max(500).optional().or(z.literal('')),
});

router.get('/events/:eventId/guests', requireAuth, requireEventOwnership, validateUuidParam('eventId'), asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const eventGuests = await db
    .select()
    .from(guests)
    .where(eq(guests.eventId, eventId))
    .orderBy(desc(guests.createdAt));

  res.json({ guests: eventGuests });
}));

router.post('/events/:eventId/rsvp', verifyTurnstileOptional, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const data = rsvpSchema.parse(req.body);

  const [guest] = await db
    .insert(guests)
    .values({
      eventId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      companions: data.companions,
      dietaryRestrictions: data.dietaryRestrictions || null,
      message: data.message || null,
    })
    .returning();

  res.status(201).json({ guest });
}));

export default router;

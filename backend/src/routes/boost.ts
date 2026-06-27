import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, cashFunds } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';
import { validateUuidParam } from '../middleware/validateUuid.js';

const router = Router();

router.post('/events/:eventId/boost', requireAuth, paymentLimiter, validateUuidParam('eventId'), asyncHandler(async (req: AuthRequest, res) => {
  const eventId = String(req.params.eventId);
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const [event] = await db
    .select({ id: events.id, userId: events.userId, boostedUntil: events.boostedUntil })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado');
  if (event.userId !== req.user!.userId) throw new ForbiddenError('No tienes permiso');

  if (event.boostedUntil && new Date(event.boostedUntil) > new Date()) {
    res.json({ message: 'Este evento ya está boosteado', boostedUntil: event.boostedUntil });
    return;
  }

  const boostedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.update(events).set({ boostedUntil: sql`${boostedUntil}::timestamp` }).where(eq(events.id, eventId));
  await db.insert(cashFunds).values({ eventId, title: 'Lluvia de sobres', isActive: true }).onConflictDoNothing({ target: cashFunds.eventId });
  res.json({ message: 'Lluvia de sobres activada con éxito ⚡💰', boostedUntil });
}));

router.get('/events/:eventId/boost-status', validateUuidParam('eventId'), asyncHandler(async (req, res) => {
  const eventId = String(req.params.eventId);
  const [event] = await db
    .select({ boostedUntil: events.boostedUntil })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado');

  const isBoosted = event.boostedUntil ? new Date(event.boostedUntil) > new Date() : false;
  res.json({ isBoosted, boostedUntil: event.boostedUntil });
}));

export default router;

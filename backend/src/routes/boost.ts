import { Router } from 'express';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as boostService from '../services/boost.js';
import { NotFoundError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

router.post(
  '/events/:eventId/boost',
  requireAuth,
  paymentLimiter,
  verifyTurnstile,
  requireEventOwnership,
  validateUuidParam('eventId'),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await boostService.boostEvent(req.params.eventId, req.user!.userId, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    if (result.boosted) {
      res.json({ message: 'Lluvia de sobres activada con éxito ⚡💰', boostedUntil: result.boostedUntil });
    } else {
      res.json({ message: 'Este evento ya está boosteado', boostedUntil: result.boostedUntil });
    }
  }),
);

router.get('/events/:eventId/boost-status', validateUuidParam('eventId'), asyncHandler(async (req, res) => {
  const eventId = String(req.params.eventId);
  const [event] = await db
    .select({ boostedUntil: events.boostedUntil })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt), sql`${events.isActive} = true`))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado');

  const isBoosted = event.boostedUntil ? new Date(event.boostedUntil) > new Date() : false;
  res.json({ isBoosted, boostedUntil: event.boostedUntil });
}));

export default router;

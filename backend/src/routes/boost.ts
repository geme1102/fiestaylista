import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import * as mercadopagoService from '../services/mercadopago.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const BOOST_DAYS = 30;

router.post('/events/:eventId/boost', requireAuth, async (req: AuthRequest, res, next) => {
  try {
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

    const successUrl = `${config.FRONTEND_URL}/event/${eventId}?boosted=1`;
    const result = await mercadopagoService.createBoostPreference(
      eventId,
      req.user!.userId,
      successUrl,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/events/:eventId/boost-status', async (req, res, next) => {
  try {
    const eventId = String(req.params.eventId);
    const [event] = await db
      .select({ boostedUntil: events.boostedUntil })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) throw new NotFoundError('Evento no encontrado');

    const isBoosted = event.boostedUntil ? new Date(event.boostedUntil) > new Date() : false;
    res.json({ isBoosted, boostedUntil: event.boostedUntil });
  } catch (error) {
    next(error);
  }
});

export default router;

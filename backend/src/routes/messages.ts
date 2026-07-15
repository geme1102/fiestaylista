import { Router } from 'express';
import { z } from 'zod';
import { eq, and, isNull, desc } from 'drizzle-orm';

import { sanitize, sanitizeAndStrip } from '../utils/sanitize.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { events, messages } from '../db/schema.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { emitMessagePosted } from '../services/notifications.js';
import { verifyTurnstile } from '../middleware/turnstile.js';

const router = Router();

const createMessageSchema = z.object({
  authorName: z.string().min(1, 'El nombre es requerido').max(100),
  message: z.string().min(1, 'El mensaje es requerido').max(1000, 'El mensaje es demasiado largo'),
});

router.get('/events/:eventId/messages', validateUuidParam('eventId'), asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.isActive, true), isNull(events.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado o inactivo');

  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 200);

  const eventMessages = await db
    .select({
      id: messages.id,
      eventId: messages.eventId,
      authorName: messages.authorName,
      message: messages.message,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.eventId, eventId))
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  const hasMore = eventMessages.length > limit;
  res.json({ messages: hasMore ? eventMessages.slice(0, limit) : eventMessages, hasMore });
}));

router.post('/events/:eventId/messages', apiLimiter, verifyTurnstile, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.status, 'active'), eq(events.isActive, true), isNull(events.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado o inactivo');

  const data = createMessageSchema.parse(req.body);
  const [msg] = await db
    .insert(messages)
    .values({ eventId, authorName: sanitize(data.authorName), message: sanitizeAndStrip(data.message) })
    .returning();

  emitMessagePosted({
    eventId,
    authorName: data.authorName,
    messagePreview: data.message.slice(0, 80),
    timestamp: msg.createdAt?.toISOString() ?? new Date().toISOString(),
  });

  res.status(201).json({ message: msg });
}));

export default router;

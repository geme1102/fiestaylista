import { Router } from 'express';
import { z } from 'zod';
import { eq, and, isNull, desc, lt, type SQL } from 'drizzle-orm';

import { sanitize, sanitizeAndStrip } from '../utils/sanitize.js';
import { messageLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { events, messages } from '../db/schema.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { emitMessagePosted } from '../services/notifications.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import type { AuthRequest } from '../types/index.js';

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
    .where(and(
      eq(events.id, eventId),
      eq(events.isActive, true),
      eq(events.status, 'active'),
      isNull(events.deletedAt),
    ))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado o inactivo');

  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 200);
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const cursor = cursorRaw && !Number.isNaN(Date.parse(cursorRaw)) ? new Date(cursorRaw) : null;

  const conditions: (ReturnType<typeof eq> | ReturnType<typeof lt> | SQL)[] = [eq(messages.eventId, eventId)];
  if (cursor) {
    conditions.push(lt(messages.createdAt, cursor));
  }

  const eventMessages = await db
    .select({
      id: messages.id,
      eventId: messages.eventId,
      authorName: messages.authorName,
      message: messages.message,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  const hasMore = eventMessages.length > limit;
  const result = hasMore ? eventMessages.slice(0, limit) : eventMessages;
  const nextCursor = hasMore && result.length > 0 ? result[result.length - 1].createdAt.toISOString() : null;

  res.json({ messages: result, hasMore, nextCursor });
}));

router.post('/events/:eventId/messages', messageLimiter, verifyTurnstile, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req, res) => {
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
    authorName: sanitize(data.authorName),
    messagePreview: sanitizeAndStrip(data.message).slice(0, 80),
    timestamp: msg.createdAt?.toISOString() ?? new Date().toISOString(),
  });

  res.status(201).json({ message: msg });
}));

router.delete('/events/:eventId/messages/:messageId', requireAuth, validateUuidParam('eventId'), validateUuidParam('messageId'), requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  const messageId = req.params.messageId as string;
  if (!messageId) throw new ValidationError('ID del mensaje requerido');

  const [msg] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.eventId, eventId)))
    .limit(1);

  if (!msg) throw new NotFoundError('Mensaje no encontrado');

  await db.delete(messages).where(and(eq(messages.id, messageId), eq(messages.eventId, eventId)));
  res.json({ success: true });
}));

export default router;

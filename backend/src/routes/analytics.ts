import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { eventViews, events } from '../db/schema.js';
import { viewLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { requireTier, requireActiveSubscription } from '../middleware/subscription.js';
import type { AuthRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateUuidParam } from '../middleware/validateUuid.js';

const router = Router();

const viewSchema = z.object({
  eventId: z.string().uuid('ID de evento invalido'),
});

router.post('/analytics/view', viewLimiter, asyncHandler(async (req: Request, res: Response) => {
  try {
    const parsed = viewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(200).json({ ok: true });
      return;
    }
    const { eventId } = parsed.data;

    await db.transaction(async (tx) => {
      await tx.insert(eventViews).values({
        eventId,
        referrer: (req.headers.referer || req.headers.referrer || 'direct') as string,
        userAgent: (req.headers['user-agent'] || 'unknown') as string,
      });

      await tx
        .update(events)
        .set({ viewCount: sql`${events.viewCount} + 1` })
        .where(eq(events.id, eventId));
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Analytics] Error registrando vista:', err);
    res.status(200).json({ ok: true });
  }
}));

router.get('/analytics/views/:eventId', requireAuth, requireTier('pro'), requireActiveSubscription(), validateUuidParam('eventId'), asyncHandler(async (req: AuthRequest, res: Response, next) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user!.userId;

    const [event] = await db
      .select({ ownerId: events.userId, views: events.viewCount })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event || event.ownerId !== userId) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }

    res.json({ eventId, views: event.views ?? 0 });
  } catch (err) {
    next(err);
  }
}));

router.post('/analytics/views/batch', requireAuth, requireTier('pro'), requireActiveSubscription(), asyncHandler(async (req: AuthRequest, res: Response, next) => {
  try {
    const parsed = z.object({ eventIds: z.array(z.string().uuid()).max(50) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Lista de IDs inválida' });
      return;
    }
    const { eventIds } = parsed.data;
    const userId = req.user!.userId;

    const rows = await db
      .select({ id: events.id, viewCount: events.viewCount })
      .from(events)
      .where(sql`${events.id} = ANY(${eventIds}) AND ${events.userId} = ${userId}`);

    const viewMap: Record<string, number> = {};
    for (const row of rows) {
      viewMap[row.id] = row.viewCount ?? 0;
    }

    res.json({ views: viewMap });
  } catch (err) {
    next(err);
  }
}));

export default router;

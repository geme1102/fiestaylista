import { Router } from 'express';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, gifts } from '../db/schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFoundError } from '../utils/errors.js';
import { apiLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(apiLimiter);

router.get('/public/events/:slug', asyncHandler(async (req, res) => {
  const eventSlug = req.params.slug as string;
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      eventType: events.eventType,
      slug: events.slug,
      isActive: events.isActive,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(and(eq(events.slug, eventSlug), isNull(events.deletedAt)))
    .limit(1);

  if (!event || !event.isActive) {
    throw new NotFoundError('Evento no encontrado');
  }

  res.json({ event });
}));

router.get('/public/events/:slug/gifts', asyncHandler(async (req, res) => {
  const eventSlug = req.params.slug as string;
  const [event] = await db
    .select({ id: events.id, isActive: events.isActive })
    .from(events)
    .where(and(eq(events.slug, eventSlug), isNull(events.deletedAt)))
    .limit(1);

  if (!event || !event.isActive) {
    throw new NotFoundError('Evento no encontrado');
  }

  const eventGifts = await db
    .select({
      id: gifts.id,
      name: gifts.name,
      isClaimed: gifts.isClaimed,
      claimedBy: gifts.claimedBy,
      createdAt: gifts.createdAt,
    })
    .from(gifts)
    .where(and(eq(gifts.eventId, event.id), isNull(gifts.deletedAt)))
    .orderBy(gifts.createdAt)
    .limit(101);

  res.json({ gifts: eventGifts });
}));

router.get('/public/stats', asyncHandler(async (_req, res) => {
  const [eventCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events);

  res.json({
    status: 'online',
    events: Number(eventCount?.count ?? 0),
    api: 'v1',
    docs: '/api/public/docs',
  });
}));

router.get('/public/docs', (_req, res) => {
  res.json({
    api: 'Fiesta y Lista Public API v1',
    endpoints: {
      event: 'GET /api/public/events/:slug',
      gifts: 'GET /api/public/events/:slug/gifts',
      stats: 'GET /api/public/stats',
      docs: 'GET /api/public/docs',
    },
  });
});

export default router;

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicStatsLimiter } from '../middleware/rateLimit.js';

const router = Router();

function cacheControl(seconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
    next();
  };
}

router.get('/public/stats', publicStatsLimiter, cacheControl(300), asyncHandler(async (_req, res) => {
  const [eventCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(isNull(events.deletedAt));

  res.json({
    status: 'online',
    events: Number(eventCount?.count ?? 0),
    api: 'v1',
  });
}));

router.get('/public/events', publicStatsLimiter, cacheControl(3600), asyncHandler(async (_req, res) => {
  const rows = await db
    .select({ slug: events.slug, updatedAt: events.updatedAt })
    .from(events)
    .where(sql`${events.isActive} = true AND ${events.deletedAt} IS NULL AND ${events.status} = 'active'`)
    .orderBy(events.createdAt)
    .limit(500);

  res.json(rows
    .filter((r) => r.slug)
    .map((r) => ({ slug: r.slug, updatedAt: r.updatedAt?.toISOString() ?? null })),
  );
}));

export default router;

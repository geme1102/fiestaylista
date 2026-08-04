import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { sql, and, isNull, type SQL } from 'drizzle-orm';
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

router.get('/public/events', publicStatsLimiter, cacheControl(300), asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 100);
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const cursor = cursorRaw && !Number.isNaN(Date.parse(cursorRaw)) ? cursorRaw : null;

  const conditions: SQL[] = [
    sql`${events.isActive} = true`,
    sql`${events.deletedAt} IS NULL`,
    sql`${events.status} = 'active'`,
  ];
  if (cursor) {
    conditions.push(sql`${events.createdAt} > ${cursor}::timestamptz`);
  }

  const rows = await db
    .select({ slug: events.slug, updatedAt: events.updatedAt, createdAt: events.createdAt })
    .from(events)
    .where(and(...conditions))
    .orderBy(events.createdAt)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const result = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && result.length > 0 ? result[result.length - 1].createdAt?.toISOString() : null;

  res.json({
    events: result.filter(r => r.slug).map(r => ({ slug: r.slug, updatedAt: r.updatedAt?.toISOString() ?? null })),
    hasMore,
    nextCursor,
  });
}));

export default router;

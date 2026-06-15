import { Router } from 'express';
import { sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicStatsLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/public/stats', publicStatsLimiter, asyncHandler(async (_req, res) => {
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

export default router;

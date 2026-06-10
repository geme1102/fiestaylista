import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { apiLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(apiLimiter);

router.get('/public/stats', asyncHandler(async (_req, res) => {
  const [eventCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events);

  res.json({
    status: 'online',
    events: Number(eventCount?.count ?? 0),
    api: 'v1',
  });
}));

export default router;

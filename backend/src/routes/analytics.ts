import { Router, type Request, type Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { eventViews, events } from '../db/schema.js';

const router = Router();

router.post('/analytics/view', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body as { eventId?: string };
    if (!eventId) {
      res.status(200).json({ ok: true });
      return;
    }

    await db.insert(eventViews).values({
      eventId,
      referrer: (req.headers.referer || req.headers.referrer || 'direct') as string,
      userAgent: (req.headers['user-agent'] || 'unknown') as string,
    });

    await db
      .update(events)
      .set({ viewCount: sql`${events.viewCount} + 1` })
      .where(eq(events.id, eventId));

    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: true });
  }
});

router.get('/analytics/views/:eventId', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.eventId;

    const [result] = await db
      .select({ views: events.viewCount })
      .from(events)
      .where(eq(events.id, eventId as string))
      .limit(1);

    res.json({ eventId, views: result?.views ?? 0 });
  } catch {
    res.json({ eventId: req.params.eventId, views: 0 });
  }
});

export default router;

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

// E3 (auditoría forense): /api/public/events ELIMINADO. El frontend nunca lo
// consume (verificado por grep) y era el directorio público del catálogo
// completo: listaba los slugs de TODOS los eventos activos con slugs
// derivados del título ("boda-de-ana") — enumeración total de eventos reales
// (fechas, ubicaciones, fotos, regalos con nombres de invitados) con cache
// de CDN de 5 min. La privacidad de los eventos se apoya en la oscuridad del
// slug + el turnstile de los endpoints de invitados; este endpoint la anulaba.

export default router;

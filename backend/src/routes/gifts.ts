import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { giftLimiter, contributeLimiter, apiLimiter } from '../middleware/rateLimit.js';
import { checkGiftLimit } from '../middleware/subscription.js';
import * as giftService from '../services/gift.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { emitGiftClaimed } from '../services/notifications.js';

const clients = new Map<string, Set<Response>>();

// SSE scavenger: limpia conexiones abandonadas cada 5 minutos
const SSE_SCAVENGER_INTERVAL_MS = 5 * 60 * 1000;
let scavengerTimer: ReturnType<typeof setInterval> | null = null;

function startSSEScavenger() {
  if (scavengerTimer) return;
  scavengerTimer = setInterval(() => {
    for (const [eventId, eventClients] of clients) {
      for (const client of eventClients) {
        try {
          client.write(':ping\n\n');
        } catch {
          eventClients.delete(client);
        }
      }
      if (eventClients.size === 0) {
        clients.delete(eventId);
      }
    }
  }, SSE_SCAVENGER_INTERVAL_MS);
}

function stopSSEScavenger() {
  if (scavengerTimer) {
    clearInterval(scavengerTimer);
    scavengerTimer = null;
  }
}

startSSEScavenger();

const router = Router({ mergeParams: true });

const createGiftSchema = z.object({
  name: z.string().min(1, 'El nombre del regalo es requerido').max(200, 'El nombre es demasiado largo'),
});

const updateGiftSchema = z.object({
  isClaimed: z.boolean().optional(),
  claimedBy: z.string().nullable().optional(),
});

const claimGiftSchema = z.object({
  claimedBy: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
});

router.get('/', giftLimiter, asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const gifts = await giftService.getEventGifts(eventId);
  res.json({ gifts });
}));

router.post('/', requireAuth, requireEventOwnership, (req: AuthRequest, res: Response, next: NextFunction) => {
  const eventId = req.params.eventId;
  if (!eventId) return next(new ValidationError('ID del evento requerido'));
  checkGiftLimit(eventId)(req, res, next);
}, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  const data = createGiftSchema.parse(req.body);

  const gift = await giftService.addGift(eventId, data.name);
  res.status(201).json({ gift });
}));

router.put('/:giftId', requireAuth, requireEventOwnership, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = updateGiftSchema.parse(req.body);
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const gift = await giftService.updateGift(giftId, data);
  res.json({ gift });
}));

router.put('/:giftId/claim', contributeLimiter, asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const { claimedBy } = claimGiftSchema.parse(req.body);
  const gift = await giftService.claimGift(giftId, claimedBy);

  const data = {
    eventId: eventId || '',
    giftId: gift.id,
    giftName: gift.name,
    claimedBy: gift.claimedBy || '',
    timestamp: new Date().toISOString(),
  };

  emitGiftClaimed(data);

  const eventClients = clients.get(data.eventId);
  if (eventClients) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of eventClients) {
      try { client.write(payload); } catch { /* cliente desconectado */ }
    }
  }

  res.json({ gift });
}));

router.put('/:giftId/free', requireAuth, requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const gift = await giftService.releaseGift(giftId);
  res.json({ gift });
}));

router.delete('/:giftId', requireAuth, requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const result = await giftService.deleteGift(giftId);
  res.json(result);
}));

router.post('/sse-token', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const sseToken = jwt.sign(
    { eventId, scope: 'sse', userId: req.user!.userId },
    config.JWT_SECRET,
    { expiresIn: '2m' },
  );
  res.json({ token: sseToken });
}));

router.post('/public-sse-token', apiLimiter, asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const [event] = await db
    .select({ id: events.id, isActive: events.isActive, slug: events.slug })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!event || !event.isActive) {
    throw new NotFoundError('Evento no encontrado');
  }

  const sseToken = jwt.sign(
    { eventId, scope: 'sse', type: 'guest' },
    config.JWT_SECRET,
    { expiresIn: '2m' },
  );
  res.json({ token: sseToken });
}));

const SSE_MAX_CONNECTIONS_PER_EVENT = 50;
const SSE_MAX_PER_IP = 3;
const SSE_CONNECTION_TIMEOUT_MS = 30 * 60 * 1000;
const sseIpCount = new Map<string, number>();

router.get('/subscribe', apiLimiter, (async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  if (!eventId) {
    res.status(400).json({ error: 'ID del evento requerido' });
    return;
  }

  const authToken = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
  if (!authToken) {
    res.status(401).json({ error: 'Token requerido para suscripción SSE' });
    return;
  }

  try {
    const decoded = jwt.verify(authToken, config.JWT_SECRET) as any;
    if (decoded.scope !== 'sse' || decoded.eventId !== eventId) {
      res.status(403).json({ error: 'Token SSE inválido para este evento' });
      return;
    }
  } catch {
    res.status(403).json({ error: 'Token inválido' });
    return;
  }

  const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const ipConnections = sseIpCount.get(clientIp) ?? 0;
  if (ipConnections >= SSE_MAX_PER_IP) {
    res.status(429).json({ error: 'Demasiadas conexiones SSE desde esta IP' });
    return;
  }

  const currentConnections = clients.get(eventId);
  if (currentConnections && currentConnections.size >= SSE_MAX_CONNECTIONS_PER_EVENT) {
    res.status(429).json({ error: 'Demasiadas conexiones SSE para este evento' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  if (!clients.has(eventId)) {
    clients.set(eventId, new Set());
  }
  clients.get(eventId)!.add(res);
  sseIpCount.set(clientIp, ipConnections + 1);

  const keepAlive = setInterval(() => {
    try { res.write(':keepalive\n\n'); } catch { /* cliente desconectado */ }
  }, 30000);

  const connectionTimeout = setTimeout(() => {
    try { res.end(); } catch { /* ya desconectado */ }
  }, SSE_CONNECTION_TIMEOUT_MS);

  const cleanup = () => {
    clearInterval(keepAlive);
    clearTimeout(connectionTimeout);
    const eventClients = clients.get(eventId);
    if (eventClients) {
      eventClients.delete(res);
      if (eventClients.size === 0) {
        clients.delete(eventId);
      }
    }
    const current = sseIpCount.get(clientIp) ?? 0;
    if (current <= 1) {
      sseIpCount.delete(clientIp);
    } else {
      sseIpCount.set(clientIp, current - 1);
    }
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
}) as any);

export default router;
export { stopSSEScavenger };

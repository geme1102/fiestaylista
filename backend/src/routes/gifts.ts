import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { giftLimiter, contributeLimiter } from '../middleware/rateLimit.js';
import * as giftService from '../services/gift.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { sendError } from '../utils/response.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import type { AuthRequest } from '../types/index.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { emitGiftClaimed, subscribeClient, unsubscribeClient, getClientCount, incrementClientIp, getClientIpCount, startSSEScavenger } from '../services/notifications.js';

startSSEScavenger();

const router = Router({ mergeParams: true });

export const createGiftSchema = z.object({
  name: z.string().min(1, 'El nombre del regalo es requerido').max(200, 'El nombre es demasiado largo'),
});

export const updateGiftSchema = z.object({
  isClaimed: z.boolean().optional(),
  claimedBy: z.string().nullable().optional(),
});

const claimGiftSchema = z.object({
  claimedBy: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
});

router.get('/', giftLimiter, validateUuidParam('eventId'), (_req, res, next) => { res.set('Cache-Control', 'public, max-age=30, s-maxage=60'); next(); }, asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const [event] = await db
    .select({ isActive: events.isActive })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);
  if (!event || !event.isActive) {
    throw new NotFoundError('Evento no encontrado');
  }
  const result = await giftService.getEventGifts(eventId, {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: req.query.cursor as string | undefined,
  });
  res.json({ gifts: result.gifts, hasMore: result.hasMore });
}));

router.post('/', requireAuth, validateUuidParam('eventId'), requireEventOwnership, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  const data = createGiftSchema.parse(req.body);

  const gift = await giftService.addGift(eventId, data.name);
  res.status(201).json({ gift });
}));

router.put('/:giftId', requireAuth, validateUuidParam('eventId'), validateUuidParam('giftId'), requireEventOwnership, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = updateGiftSchema.parse(req.body);
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const gift = await giftService.updateGift(giftId, data);
  res.json({ gift });
}));

router.put('/:giftId/claim', contributeLimiter, verifyTurnstile, validateUuidParam('eventId'), validateUuidParam('giftId'), asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string | undefined;
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const { claimedBy } = claimGiftSchema.parse(req.body);
  const gift = await giftService.claimGift(giftId, claimedBy, eventId);

  const data = {
    eventId: eventId || '',
    giftId: gift.id,
    giftName: gift.name,
    claimedBy: gift.claimedBy || '',
    timestamp: new Date().toISOString(),
  };

  emitGiftClaimed(data);

  res.json({ gift });
}));

router.put('/:giftId/free', requireAuth, validateUuidParam('eventId'), validateUuidParam('giftId'), requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const gift = await giftService.releaseGift(giftId, req.user!.userId);
  res.json({ gift });
}));

router.delete('/:giftId', requireAuth, validateUuidParam('eventId'), validateUuidParam('giftId'), requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) {
    throw new ValidationError('ID del regalo requerido');
  }
  const result = await giftService.deleteGift(giftId);
  res.json(result);
}));

const groupClaimSchema = z.object({
  claimedBy: z.string().min(1, 'El nombre es requerido').max(100),
  message: z.string().max(500).optional(),
});

router.put('/:giftId/group-claim', contributeLimiter, verifyTurnstile, validateUuidParam('eventId'), validateUuidParam('giftId'), asyncHandlerWithValidation(async (req, res) => {
  const eventId = req.params.eventId as string;
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) throw new ValidationError('ID del regalo requerido');

  const data = groupClaimSchema.parse(req.body);
  const result = await giftService.addGroupClaim(giftId, data.claimedBy, data.message, eventId);

  const claims = await giftService.getGiftClaims(giftId);

  emitGiftClaimed({
    eventId,
    giftId,
    giftName: '',
    claimedBy: data.claimedBy,
    claims: claims.map((c) => ({ id: c.id, claimedBy: c.claimedBy })),
    timestamp: new Date().toISOString(),
  });

  res.status(201).json(result);
}));

router.get('/:giftId/claims', giftLimiter, validateUuidParam('eventId'), validateUuidParam('giftId'), asyncHandler(async (req, res) => {
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) throw new ValidationError('ID del regalo requerido');

  const claims = await giftService.getGiftClaims(giftId);
  res.json({ claims });
}));

router.put('/:giftId/toggle-group', requireAuth, validateUuidParam('eventId'), validateUuidParam('giftId'), requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const giftId = req.params.giftId as string | undefined;
  if (!giftId) throw new ValidationError('ID del regalo requerido');

  let isGroupGift: boolean;
  try {
    ({ isGroupGift } = z.object({ isGroupGift: z.boolean() }).parse(req.body));
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ValidationError(err.errors.map(e => e.message).join(', '));
    }
    throw err;
  }
  const gift = await giftService.toggleGroupGift(giftId, isGroupGift);
  res.json({ gift });
}));

router.post('/sse-token', requireAuth, validateUuidParam('eventId'), requireEventOwnership, asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) {
    throw new ValidationError('ID del evento requerido');
  }
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);
  if (!event) {
    throw new NotFoundError('Evento no encontrado');
  }
  const sseToken = jwt.sign(
    { eventId, scope: 'sse', userId: req.user!.userId },
    config.JWT_SECRET,
    { expiresIn: `${SSE_TOKEN_TTL_S}s` },
  );
  res.json({ token: sseToken, url: `${config.BACKEND_URL}/api/events/${eventId}/gifts/subscribe` });
}));

// D2-A2: sin apiLimiter a nivel de ruta — ya corre el global en app.use('/api').
router.post('/public-sse-token', verifyTurnstile, validateUuidParam('eventId'), asyncHandler(async (req, res) => {
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
    { expiresIn: `${SSE_TOKEN_TTL_S}s` },
  );
  res.json({ token: sseToken, url: `${config.BACKEND_URL}/api/events/${eventId}/gifts/subscribe` });
}));

// D8-M: los contadores de conexiones SSE viven en Mapas por proceso
// (notifications.ts). En cluster un cliente podía abrir N× el tope (3 pestañas
// × N workers) y un evento N×50 conexiones. Los cupos globales se reparten
// entre workers (ceil para no dejarlos en 0 en configs pequeñas).
const clusterWorkers = config.CLUSTER_WORKERS > 0 ? config.CLUSTER_WORKERS : 1;
const SSE_MAX_CONNECTIONS_PER_EVENT = Math.ceil(50 / clusterWorkers);
// E2: 3→10 — con egress de Netlify compartido por PoP (ver rateLimit.ts), 3
// conexiones por IP bloqueaban el SSE en vivo de un evento con 4+ invitados
// en el mismo PoP. El tope global por evento (50) y el token SSE de 2 min
// siguen acotando el uso.
const SSE_MAX_PER_IP = Math.ceil(10 / clusterWorkers);
// F4: el token SSE expira a los 2 min y la conexión DEBE cortarse exactamente
// al expirar (enviando 'reconnect' para que el cliente renueve token). Antes
// el timeout era de 4 min: entre el minuto 2 y el 4 la conexión seguía viva
// con un token ya expirado y los eventos seguían fluyendo a una conexión que
// ya no era válida (ni revocable al expirar). Misma constante que expiresIn
// de /sse-token y /public-sse-token para que nunca se desincronicen.
export const SSE_TOKEN_TTL_S = 120;
export const SSE_CONNECTION_TIMEOUT_MS = SSE_TOKEN_TTL_S * 1000;
const SSE_KEEPALIVE_MS = 15000;

// B5: sin apiLimiter a nivel de ruta — ya corre el global en `app.use('/api',
// apiLimiter)`: duplicarlo contaba cada conexión SSE dos veces contra la misma
// cuota y acercaba el límite global al doble de rápido.
router.get('/subscribe', asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  if (!eventId) {
    sendError(res, 400, 'ID del evento requerido');
    return;
  }

  const authToken = req.headers.authorization?.replace('Bearer ', '') || (typeof req.query.token === 'string' ? req.query.token : null);
  if (!authToken) {
    sendError(res, 401, 'Token requerido para suscripción SSE');
    return;
  }

  try {
    const decoded = jwt.verify(authToken, config.JWT_SECRET, { algorithms: ['HS256'] }) as { scope: string; eventId: string };
    if (decoded.scope !== 'sse' || decoded.eventId !== eventId) {
      sendError(res, 403, 'Token SSE inválido para este evento');
      return;
    }
  } catch {
    sendError(res, 403, 'Token inválido');
    return;
  }

  const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if (getClientIpCount(clientIp) >= SSE_MAX_PER_IP) {
    sendError(res, 429, 'Demasiadas conexiones SSE desde esta IP');
    return;
  }

  const currentConnections = getClientCount(eventId);
  if (currentConnections >= SSE_MAX_CONNECTIONS_PER_EVENT) {
    sendError(res, 429, 'Demasiadas conexiones SSE para este evento');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  subscribeClient(eventId, res);
  incrementClientIp(res, clientIp);

  const keepAlive = setInterval(() => {
    try { res.write(':keepalive\n\n'); } catch { /* cliente desconectado */ }
  }, SSE_KEEPALIVE_MS);

  const connectionTimeout = setTimeout(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'reconnect' })}\n\n`);
      res.end();
    } catch { /* ya desconectado */ }
  }, SSE_CONNECTION_TIMEOUT_MS);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(keepAlive);
    clearTimeout(connectionTimeout);
    unsubscribeClient(eventId, res);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
}));

export default router;

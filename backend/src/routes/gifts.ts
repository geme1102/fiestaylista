import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { giftLimiter } from '../middleware/rateLimit.js';
import { checkGiftLimit } from '../middleware/subscription.js';
import * as giftService from '../services/gift.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';
import { config } from '../config.js';
import { emitGiftClaimed } from '../services/notifications.js';

const clients = new Map<string, Set<Response>>();

const router = Router({ mergeParams: true });

const createGiftSchema = z.object({
  name: z.string().min(1, 'El nombre del regalo es requerido').max(200, 'El nombre es demasiado largo'),
});

const updateGiftSchema = z.object({
  isClaimed: z.boolean().optional(),
  claimedBy: z.string().nullable().optional(),
});

router.get('/', giftLimiter, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId as string | undefined;
    if (!eventId) {
      throw new ValidationError('ID del evento requerido');
    }
    const gifts = await giftService.getEventGifts(eventId);
    res.json({ gifts });
  } catch (error) {
    next(error);
  }
}) as any);

router.post('/', requireAuth, requireEventOwnership, (async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId as string | undefined;
    if (!eventId) {
      throw new ValidationError('ID del evento requerido');
    }

    const data = createGiftSchema.parse(req.body);

    const limitCheck = checkGiftLimit(eventId);
    await new Promise<void>((resolve, reject) => {
      limitCheck(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const gift = await giftService.addGift(eventId, data.name);
    res.status(201).json({ gift });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
}) as any);

router.put('/:giftId', requireAuth, requireEventOwnership, (async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateGiftSchema.parse(req.body);
    const giftId = req.params.giftId as string | undefined;
    if (!giftId) {
      throw new ValidationError('ID del regalo requerido');
    }
    const gift = await giftService.updateGift(giftId, data);
    res.json({ gift });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
}) as any);

router.put('/:giftId/claim', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId as string | undefined;
    const giftId = req.params.giftId as string | undefined;
    if (!giftId) {
      throw new ValidationError('ID del regalo requerido');
    }
    const { claimedBy } = req.body as { claimedBy?: string };
    if (!claimedBy?.trim()) {
      throw new ValidationError('El nombre es requerido para apartar el regalo');
    }
    const gift = await giftService.claimGift(giftId, claimedBy.trim());

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
        client.write(payload);
      }
    }

    res.json({ gift });
  } catch (error) {
    next(error);
  }
}) as any);

router.put('/:giftId/free', requireAuth, requireEventOwnership, (async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const giftId = req.params.giftId as string | undefined;
    if (!giftId) {
      throw new ValidationError('ID del regalo requerido');
    }
    const gift = await giftService.releaseGift(giftId);
    res.json({ gift });
  } catch (error) {
    next(error);
  }
}) as any);

router.delete('/:giftId', requireAuth, requireEventOwnership, (async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const giftId = req.params.giftId as string | undefined;
    if (!giftId) {
      throw new ValidationError('ID del regalo requerido');
    }
    const result = await giftService.deleteGift(giftId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}) as any);

router.get('/subscribe', (async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  if (!eventId) {
    res.status(400).json({ error: 'ID del evento requerido' });
    return;
  }

  const authToken = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');
  if (!authToken) {
    res.status(401).json({ error: 'Token requerido para suscripción SSE' });
    return;
  }

  try {
    jwt.verify(authToken, config.JWT_SECRET);
  } catch {
    res.status(403).json({ error: 'Token inválido' });
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

  const keepAlive = setInterval(() => {
    try { res.write(':keepalive\n\n'); } catch { /* ignore */ }
  }, 30000);

  const cleanup = () => {
    clearInterval(keepAlive);
    const eventClients = clients.get(eventId);
    if (eventClients) {
      eventClients.delete(res);
      if (eventClients.size === 0) {
        clients.delete(eventId);
      }
    }
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
}) as any);

export default router;

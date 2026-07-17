import { Router } from 'express';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';

import { contributeLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import * as cashFundService from '../services/cashFund.js';
import { getPromisedAmount } from '../services/cashFund.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { sanitizeAndStrip } from '../utils/sanitize.js';
import type { AuthRequest } from '../types/index.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { requireAuth, requireEmailVerified, optionalAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { db } from '../db/index.js';
import { events, cashFunds } from '../db/schema.js';

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '****' + digits.slice(-4);
}

const router = Router();

const createFundSchema = z.object({
  title: z.string().min(1).max(200).transform(s => sanitizeAndStrip(s)).optional(),
  description: z.string().max(1000).transform(s => sanitizeAndStrip(s)).optional(),
  targetAmount: z.number().int().min(0).optional(),
  bankPhone: z.string().max(20).optional().nullable(),
  bankType: z.string().max(20).optional().nullable(),
});

const promiseSchema = z.object({
  cashFundId: z.string().uuid('ID de fondo inválido'),
  contributorName: z.string().min(1, 'Tu nombre es requerido').max(100),
  amount: z.number().int().min(2000, 'El monto mínimo es $2,000 COP').max(500000, 'El monto máximo es $5.000.000'),
  message: z.string().max(500).optional(),
});

router.put('/events/:eventId/cash-fund', requireAuth, requireEmailVerified, requireEventOwnership, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const data = createFundSchema.parse(req.body);
  const fund = await cashFundService.createOrUpdateCashFund(eventId, req.user!.userId, {
    title: data.title,
    description: data.description,
    targetAmount: data.targetAmount,
    bankPhone: data.bankPhone,
    bankType: data.bankType,
  });
  res.json({ cashFund: fund });
}));

router.get('/events/:eventId/cash-fund', optionalAuth, validateUuidParam('eventId'), asyncHandler(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const [event] = await db
    .select({ isActive: events.isActive, userId: events.userId })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);
  if (!event || !event.isActive) throw new NotFoundError('Evento no encontrado');

  const isOwner = event.userId === req.user?.userId;
  const fund = await cashFundService.getCashFund(eventId);

  if (fund && !isOwner && fund.bankPhone) {
    fund.bankPhone = maskPhone(fund.bankPhone);
  }

  let promisedTotal = 0;
  if (fund) {
    promisedTotal = await getPromisedAmount(fund.id);
  }
  res.json({ cashFund: fund || null, promisedTotal });
}));

router.post('/cash-fund/promise', contributeLimiter, verifyTurnstile, asyncHandlerWithValidation(async (req, res) => {
  const data = promiseSchema.parse(req.body);
  const result = await cashFundService.createPromise(
    data.cashFundId,
    data.contributorName,
    data.amount,
    data.message,
  );
  res.status(201).json(result);
}));

router.get('/cash-fund/:cashFundId/contributions', optionalAuth, validateUuidParam('cashFundId'), asyncHandler(async (req: AuthRequest, res) => {
  const cashFundId = req.params.cashFundId as string;
  if (!cashFundId) throw new ValidationError('ID del fondo requerido');

  const [activeEvent] = await db
    .select({ isActive: events.isActive, userId: events.userId })
    .from(events)
    .innerJoin(cashFunds, eq(events.id, cashFunds.eventId))
    .where(and(eq(cashFunds.id, cashFundId), isNull(events.deletedAt)))
    .limit(1);
  if (!activeEvent || !activeEvent.isActive) throw new NotFoundError('Evento no encontrado');

  const isOwner = activeEvent.userId === req.user?.userId;
  const result = await cashFundService.getContributions(cashFundId, {
    limit: isOwner ? (req.query.limit ? Number(req.query.limit) : undefined) : 5,
    cursor: isOwner ? (req.query.cursor as string | undefined) : undefined,
  });
  res.json({
    contributions: result.data,
    nextCursor: isOwner ? result.nextCursor : null,
  });
}));

router.post('/events/:eventId/cash-fund/:cashFundId/contributions/:contributionId/cancel',
  requireAuth,
  requireEmailVerified,
  requireEventOwnership,
  validateUuidParam('eventId'),
  validateUuidParam('cashFundId'),
  validateUuidParam('contributionId'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { cashFundId, contributionId } = req.params as { cashFundId: string; contributionId: string };
    const result = await cashFundService.cancelContribution(contributionId, cashFundId);
    res.json(result);
  }),
);

router.post('/events/:eventId/cash-fund/reveal-phone', validateUuidParam('eventId'), verifyTurnstile, asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const [event] = await db
    .select({ isActive: events.isActive })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);
  if (!event || !event.isActive) throw new NotFoundError('Evento no encontrado');

  const fund = await cashFundService.getCashFund(eventId);
  if (!fund) throw new NotFoundError('Fondo no encontrado');

  res.json({ bankPhone: fund.bankPhone, bankType: fund.bankType });
}));

export default router;

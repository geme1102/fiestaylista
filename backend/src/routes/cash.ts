import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';
import { contributeLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstileOptional } from '../middleware/turnstile.js';
import * as cashFundService from '../services/cashFund.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, ForbiddenError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { cashFunds, events } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';
import { validateUuidParam } from '../middleware/validateUuid.js';

const router = Router();

const createFundSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  targetAmount: z.number().int().min(0).optional(),
  bankPhone: z.string().max(20).optional().nullable(),
  bankType: z.string().max(20).optional().nullable(),
});

const contributeSchema = z.object({
  cashFundId: z.string().uuid('ID de fondo inválido'),
  contributorName: z.string().min(1, 'Tu nombre es requerido').max(100),
  amount: z.number().int().min(2000, 'El monto mínimo es $2,000 COP').max(500000, 'El monto máximo es $5.000.000'),
  message: z.string().max(500).optional(),
});

const promiseSchema = z.object({
  cashFundId: z.string().uuid('ID de fondo inválido'),
  contributorName: z.string().min(1, 'Tu nombre es requerido').max(100),
  amount: z.number().int().min(2000, 'El monto mínimo es $2,000 COP').max(500000, 'El monto máximo es $5.000.000'),
  message: z.string().max(500).optional(),
});

router.put('/events/:eventId/cash-fund', requireAuth, requireEventOwnership, validateUuidParam('eventId'), asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const data = createFundSchema.parse(req.body);
  const fund = await cashFundService.createOrUpdateCashFund(eventId, req.user!.userId, {
    title: data.title,
    description: data.description,
    targetAmount: data.targetAmount,
    bankPhone: data.bankPhone ?? undefined,
    bankType: data.bankType ?? undefined,
  });
  res.json({ cashFund: fund });
}));

router.get('/events/:eventId/cash-fund', validateUuidParam('eventId'), asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const fund = await cashFundService.getCashFund(eventId);
  if (!fund) {
    res.json({ cashFund: null });
    return;
  }
  const promisedTotal = await cashFundService.getPromisedAmount(fund.id);
  res.json({ cashFund: fund, promisedTotal });
}));

router.post('/cash-fund/contribute', contributeLimiter, verifyTurnstileOptional, asyncHandlerWithValidation(async (req, res) => {
  const data = contributeSchema.parse(req.body);
  const result = await cashFundService.createContribution(
    data.cashFundId,
    data.contributorName,
    data.amount,
    data.message,
  );
  res.status(201).json(result);
}));

router.post('/cash-fund/promise', contributeLimiter, verifyTurnstileOptional, asyncHandlerWithValidation(async (req, res) => {
  const data = promiseSchema.parse(req.body);
  const result = await cashFundService.createPromise(
    data.cashFundId,
    data.contributorName,
    data.amount,
    data.message,
  );
  res.status(201).json(result);
}));

router.get('/cash-fund/:cashFundId/contributions', requireAuth, validateUuidParam('cashFundId'), asyncHandler(async (req: AuthRequest, res) => {
  const cashFundId = req.params.cashFundId as string;
  if (!cashFundId) throw new ValidationError('ID del fondo requerido');

  const [fund] = await db
    .select({ eventId: cashFunds.eventId })
    .from(cashFunds)
    .where(eq(cashFunds.id, cashFundId))
    .limit(1);

  if (!fund) throw new ValidationError('Fondo no encontrado');

  const [event] = await db
    .select({ userId: events.userId })
    .from(events)
    .where(eq(events.id, fund.eventId))
    .limit(1);

  if (!event || event.userId !== req.user!.userId) {
    throw new ForbiddenError('No tienes permiso para ver estas contribuciones');
  }

  const result = await cashFundService.getContributions(cashFundId, {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: req.query.cursor as string | undefined,
  });
  res.json(result);
}));

export default router;

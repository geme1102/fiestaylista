import { Router } from 'express';
import { z } from 'zod';

import { contributeLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import * as cashFundService from '../services/cashFund.js';
import { getPromisedAmount } from '../services/cashFund.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';
import { validateUuidParam } from '../middleware/validateUuid.js';
import { requireAuth, requireEmailVerified } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/ownership.js';

const router = Router();

const createFundSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
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
    bankPhone: data.bankPhone ?? undefined,
    bankType: data.bankType ?? undefined,
  });
  res.json({ cashFund: fund });
}));

router.get('/events/:eventId/cash-fund', validateUuidParam('eventId'), asyncHandler(async (req, res) => {
  const eventId = req.params.eventId as string;
  if (!eventId) throw new ValidationError('ID del evento requerido');

  const fund = await cashFundService.getCashFund(eventId);
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

router.get('/cash-fund/:cashFundId/contributions', validateUuidParam('cashFundId'), asyncHandler(async (req, res) => {
  const cashFundId = req.params.cashFundId as string;
  if (!cashFundId) throw new ValidationError('ID del fondo requerido');

  const result = await cashFundService.getContributions(cashFundId, {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: req.query.cursor as string | undefined,
  });
  res.json({ contributions: result.data, nextCursor: result.nextCursor });
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

export default router;

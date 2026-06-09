import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as consentService from '../services/consent.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const consentSchema = z.object({
  type: z.enum(['terms', 'privacy', 'cookies', 'marketing']),
  version: z.string().optional(),
  granted: z.boolean().optional(),
});

router.post('/', requireAuth, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = consentSchema.parse(req.body);
  const record = await consentService.recordConsent({
    userId: req.user!.userId,
    type: data.type,
    version: data.version,
    granted: data.granted,
    req,
  });
  res.status(201).json({ consent: record });
}));

router.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const history = await consentService.getConsentHistory(req.user!.userId);
  res.json({ consents: history });
}));

export default router;

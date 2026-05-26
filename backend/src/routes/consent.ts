import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as consentService from '../services/consent.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const consentSchema = z.object({
  type: z.enum(['terms', 'privacy', 'cookies', 'marketing']),
  version: z.string().optional(),
  granted: z.boolean().optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = consentSchema.parse(req.body);
    const record = await consentService.recordConsent({
      userId: req.user!.userId,
      type: data.type,
      version: data.version,
      granted: data.granted,
      req,
    });
    res.status(201).json({ consent: record });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const history = await consentService.getConsentHistory(req.user!.userId);
    res.json({ consents: history });
  } catch (error) {
    next(error);
  }
});

export default router;

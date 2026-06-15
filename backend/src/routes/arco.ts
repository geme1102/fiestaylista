import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { arcoLimiter } from '../middleware/rateLimit.js';
import * as arcoService from '../services/arco.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const arcoRequestSchema = z.object({
  requestType: z.enum(['access', 'rectify', 'cancel', 'oppose']),
  details: z.string().optional(),
});

router.get('/my-data', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const data = await arcoService.getUserData(req.user!.userId);
  res.json({ data });
}));

router.post('/delete-account', requireAuth, arcoLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const password = req.headers['x-password'] as string | undefined;
  if (!password) {
    throw new ValidationError('Contraseña requerida para eliminar la cuenta');
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError('Contraseña incorrecta');
  }

  await arcoService.deleteUserAccount(req.user!.userId);
  res.json({ success: true });
}));

router.post('/request', requireAuth, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = arcoRequestSchema.parse(req.body);
  const request = await arcoService.createArcoRequest(
    req.user!.userId,
    data.requestType,
    data.details,
  );
  res.status(201).json({ request });
}));

router.get('/requests', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const requests = await arcoService.getArcoRequests(req.user!.userId);
  res.json({ requests });
}));

export default router;

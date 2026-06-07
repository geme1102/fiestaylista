import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { arcoLimiter } from '../middleware/rateLimit.js';
import * as arcoService from '../services/arco.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const arcoRequestSchema = z.object({
  requestType: z.enum(['access', 'rectify', 'cancel', 'oppose']),
  details: z.string().optional(),
});

router.get('/my-data', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = await arcoService.getUserData(req.user!.userId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

const confirmDeleteSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida para eliminar la cuenta'),
});

router.delete('/my-account', requireAuth, arcoLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { password } = confirmDeleteSchema.parse(req.body);

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.post('/request', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = arcoRequestSchema.parse(req.body);
    const request = await arcoService.createArcoRequest(
      req.user!.userId,
      data.requestType,
      data.details,
    );
    res.status(201).json({ request });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.get('/requests', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const requests = await arcoService.getArcoRequests(req.user!.userId);
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

export default router;

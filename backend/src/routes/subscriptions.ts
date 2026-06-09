import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter, cancelLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { config } from '../config.js';
import * as mercadopagoService from '../services/mercadopago.js';
import * as subscriptionService from '../services/subscription.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

const checkoutSchema = z.object({
  tier: z.enum(['pro'], {
    errorMap: () => ({ message: 'Plan inválido. Debe ser pro' }),
  }),
  interval: z.enum(['month', 'year']).default('month'),
  successUrl: z.string().url('URL de éxito inválida'),
  cancelUrl: z.string().url('URL de cancelación inválida'),
});

router.post('/create-checkout', verifyTurnstile, requireAuth, paymentLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = checkoutSchema.parse(req.body);

  const allowedOrigin = config.FRONTEND_URL.replace(/\/+$/, '');
  if (!data.successUrl.startsWith(allowedOrigin) || !data.cancelUrl.startsWith(allowedOrigin)) {
    throw new ValidationError('URL de redirección no permitida');
  }

  const result = await mercadopagoService.createProPreference(
    req.user!.userId,
    data.interval,
    data.successUrl,
    data.cancelUrl,
  );
  res.json(result);
}));

const confirmPasswordSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida para confirmar'),
});

router.post('/cancel', requireAuth, cancelLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const { password } = confirmPasswordSchema.parse(req.body);

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError('Contraseña incorrecta');
  }

  const sub = await subscriptionService.getCurrentSubscription(req.user!.userId);
  if (!sub) {
    res.status(400).json({ error: 'No tienes una suscripción activa' });
    return;
  }
  if (sub.mpSubscriptionId) {
    try {
      await mercadopagoService.cancelPreapproval(sub.mpSubscriptionId);
    } catch (err) {
      console.error('Error al cancelar en MercadoPago:', err);
    }
  }
  await subscriptionService.cancelSubscription(req.user!.userId);
  res.json({ message: 'Suscripción cancelada exitosamente' });
}));

router.get('/current', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const subscription = await subscriptionService.getCurrentSubscription(req.user!.userId);
  res.json({ subscription });
}));

export default router;

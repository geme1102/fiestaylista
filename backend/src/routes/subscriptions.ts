import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { config } from '../config.js';
import * as mercadopagoService from '../services/mercadopago.js';
import * as subscriptionService from '../services/subscription.js';
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

router.post('/create-checkout', requireAuth, paymentLimiter, async (req: AuthRequest, res, next) => {
  try {
    const data = checkoutSchema.parse(req.body);

    const allowedOrigin = config.FRONTEND_URL.replace(/\/+$/, '');
    if (!data.successUrl.startsWith(allowedOrigin) || !data.cancelUrl.startsWith(allowedOrigin)) {
      throw new ValidationError('URL de redirección no permitida');
    }

    const result = await mercadopagoService.createCheckoutSession(
      req.user!.userId,
      req.user!.email,
      data.tier,
      data.interval,
      data.successUrl,
      data.cancelUrl,
    );
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

const confirmPasswordSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida para confirmar'),
});

router.post('/cancel', requireAuth, async (req: AuthRequest, res, next) => {
  try {
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.get('/current', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await subscriptionService.getCurrentSubscription(req.user!.userId);
    res.json({ subscription });
  } catch (error) {
    next(error);
  }
});

export default router;

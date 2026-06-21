import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter, cancelLimiter, apiLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstileOptional } from '../middleware/turnstile.js';
import { config } from '../config.js';
import * as mercadopagoService from '../services/mercadopago.js';
import * as subscriptionService from '../services/subscription.js';
import * as mpWebhooks from '../services/mp-webhooks.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users, proPayments } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Subscriptions');

const router = Router();

const checkoutSchema = z.object({
  tier: z.enum(['pro'], {
    errorMap: () => ({ message: 'Plan inválido. Debe ser pro' }),
  }),
  interval: z.enum(['month', 'year']).default('month'),
  successUrl: z.string().url('URL de éxito inválida'),
  cancelUrl: z.string().url('URL de cancelación inválida'),
});

const cancelSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida para confirmar'),
});

router.post('/create-checkout', verifyTurnstileOptional, requireAuth, paymentLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = checkoutSchema.parse(req.body);

  const allowedOrigin = config.FRONTEND_URL.replace(/\/+$/, '');
  try {
    const successOrigin = new URL(data.successUrl).origin;
    const cancelOrigin = new URL(data.cancelUrl).origin;
    if (successOrigin !== allowedOrigin || cancelOrigin !== allowedOrigin) {
      throw new ValidationError('URL de redirección no permitida');
    }
  } catch {
    throw new ValidationError('URL de redirección inválida');
  }

  const result = await mercadopagoService.createProPreference(
    req.user!.userId,
    data.interval,
    data.successUrl,
    data.cancelUrl,
  );
  res.json(result);
}));

router.post('/sync', requireAuth, apiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const sub = await subscriptionService.getCurrentSubscription(userId);
  if (sub?.tier === 'pro' && sub?.status === 'active') {
    res.json({ tier: 'pro', synced: false, message: 'Ya tienes Pro activo' });
    return;
  }

  const [payment] = await db
    .select()
    .from(proPayments)
    .where(eq(proPayments.userId, userId))
    .orderBy(desc(proPayments.createdAt))
    .limit(1);

  if (payment) {
    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: null,
      tier: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + (payment.interval === 'year' ? 365 : 30) * 24 * 60 * 60 * 1000),
    });
    res.json({ tier: 'pro', synced: true, message: 'Suscripción activada' });
    return;
  }

  const monthRef = `pro_${userId}_month`;
  const yearRef = `pro_${userId}_year`;

  const [monthPayment, yearPayment] = await Promise.all([
    mercadopagoService.searchPaymentsByRef(monthRef),
    mercadopagoService.searchPaymentsByRef(yearRef),
  ]);

  const found = monthPayment || yearPayment;
  if (found) {
    const interval = monthPayment ? 'month' : 'year';
    await mpWebhooks.handleProPayment(found.id, userId, interval);
    res.json({ tier: 'pro', synced: true, message: 'Suscripción activada después de verificar el pago en Mercado Pago' });
    return;
  }

  res.json({ tier: 'free', synced: false, message: 'No encontramos un pago reciente. Si el problema persiste, contacta a soporte.' });
}));

router.post('/cancel', requireAuth, cancelLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const { password } = cancelSchema.parse(req.body);

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
      log.error({ err }, 'Error al cancelar en MercadoPago - la suscripción local se canceló pero MP podría seguir cobrando:');
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

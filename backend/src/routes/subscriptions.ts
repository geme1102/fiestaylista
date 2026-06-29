import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter, cancelLimiter, apiLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { config } from '../config.js';
import * as mercadopagoService from '../services/mercadopago.js';
import * as subscriptionService from '../services/subscription.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users, proPayments } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Subscriptions');

const router = Router();

const CHECKOUT_URLS: Record<string, Record<string, string>> = {
  pro: { month: config.PRO_MONTHLY_CHECKOUT_URL, year: config.PRO_YEARLY_CHECKOUT_URL },
  pro_plus: { month: config.PRO_PLUS_MONTHLY_CHECKOUT_URL },
};

const checkoutSchema = z.object({
  tier: z.enum(['pro', 'pro_plus'], {
    errorMap: () => ({ message: 'Plan inválido. Debe ser pro o pro_plus' }),
  }),
  interval: z.enum(['month', 'year']).default('month'),
  successUrl: z.string().url('URL de éxito inválida').optional(),
  cancelUrl: z.string().url('URL de cancelación inválida').optional(),
});

const cancelSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida para confirmar'),
});

router.post('/create-checkout', verifyTurnstile, requireAuth, paymentLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = checkoutSchema.parse(req.body);

  if (data.tier === 'pro_plus' && data.interval !== 'month') {
    throw new ValidationError('Pro Plus solo está disponible en plan mensual');
  }

  const url = CHECKOUT_URLS[data.tier]?.[data.interval];
  if (!url) {
    throw new ValidationError('URL de pago no configurada para este plan');
  }

  res.json({ url });
}));

router.post('/sync', requireAuth, apiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const sub = await subscriptionService.getCurrentSubscription(userId);
  if ((sub?.tier === 'pro' || sub?.tier === 'pro_plus') && sub?.status === 'active') {
    res.json({ tier: sub.tier, synced: false, message: `Ya tienes ${sub.tier === 'pro_plus' ? 'Pro Plus' : 'Pro'} activo` });
    return;
  }

  const [payment] = await db
    .select()
    .from(proPayments)
    .where(and(
      eq(proPayments.userId, userId),
      eq(proPayments.status, 'completed'),
      sql`${proPayments.createdAt} >= NOW() - INTERVAL '37 days'`,
    ))
    .orderBy(desc(proPayments.createdAt))
    .limit(1);

  if (payment) {
    const periodDays = payment.interval === 'year' ? 365 : 30;
    const periodStart = payment.createdAt ?? new Date();
    const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000);

    if (periodEnd <= new Date()) {
      res.json({ tier: 'free', synced: false, message: 'Tu pago ya expiró. Suscríbete de nuevo para continuar.' });
      return;
    }

    const tier = payment.tier ?? 'pro';
    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: null,
      tier: tier as 'pro' | 'pro_plus',
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
    res.json({ tier, synced: true, message: 'Suscripción activada' });
    return;
  }

  res.json({ tier: 'free', synced: false, message: 'No encontramos un pago reciente. Después de pagar, espera unos minutos y vuelve a intentar. Si el problema persiste, contacta a soporte.' });
}));

router.post('/cancel', requireAuth, cancelLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const password = (req.headers['x-password'] as string) || cancelSchema.parse(req.body).password;

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
      await subscriptionService.cancelSubscription(req.user!.userId);
      res.json({ message: 'Suscripción cancelada exitosamente', mpWarning: 'No pudimos cancelar el cobro automático en Mercado Pago. Si ves un cobro futuro, contáctanos para asistencia.' });
      return;
    }
  }
  await subscriptionService.cancelSubscription(req.user!.userId);
  res.json({ message: 'Suscripción cancelada exitosamente' });
}));

router.get('/current', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const subscription = await subscriptionService.getCurrentSubscription(req.user!.userId);
  res.json({ subscription });
}));

router.get('/payments', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const payments = await subscriptionService.getPaymentHistory(req.user!.userId);
  res.json({ payments });
}));

export default router;

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
import * as mpWebhooks from '../services/mp-webhooks.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { sendError } from '../utils/response.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users, proPayments } from '../db/schema.js';
import type { AuthRequest, Tier } from '../types/index.js';
import { TIER_ORDER } from '../types/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Subscriptions');

const router = Router();

const PLAN_IDS: Record<string, Record<string, string>> = {
  pro: { month: config.PRO_MONTHLY_PLAN_ID, year: config.PRO_YEARLY_PLAN_ID },
  pro_plus: { month: config.PRO_PLUS_MONTHLY_PLAN_ID },
};

const checkoutSchema = z.object({
  tier: z.enum(['pro', 'pro_plus'], {
    errorMap: () => ({ message: 'Plan inválido. Debe ser pro o pro_plus' }),
  }),
  interval: z.enum(['month', 'year']).default('month'),
  successUrl: z.string().url('URL de éxito inválida').optional().refine(
    u => !u || u.startsWith(config.FRONTEND_URL),
    { message: 'URL de éxito debe ser del dominio de la aplicación' },
  ),
  cancelUrl: z.string().url('URL de cancelación inválida').optional().refine(
    u => !u || u.startsWith(config.FRONTEND_URL),
    { message: 'URL de cancelación debe ser del dominio de la aplicación' },
  ),
});

const cancelSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida para confirmar'),
});

router.post('/create-checkout', verifyTurnstile, requireAuth, paymentLimiter, asyncHandlerWithValidation(async (req: AuthRequest, res) => {
  const data = checkoutSchema.parse(req.body);

  if (data.tier === 'pro_plus' && data.interval !== 'month') {
    throw new ValidationError('Pro Plus solo está disponible en plan mensual');
  }

  const sub = await subscriptionService.getCurrentSubscription(req.user!.userId);
  if (sub && sub.status === 'active') {
    const currentLevel = TIER_ORDER[(sub.tier ?? 'free') as Tier];
    const requestedLevel = TIER_ORDER[data.tier];
    if (requestedLevel <= currentLevel) {
      throw new ValidationError(`Ya tienes ${sub.tier === 'pro_plus' ? 'Pro Plus' : 'Pro'} activo`);
    }
  }

  const planId = PLAN_IDS[data.tier]?.[data.interval];
  const successUrl = data.successUrl || `${config.FRONTEND_URL}/dashboard?pro=activated`;
  const cancelUrl = data.cancelUrl || `${config.FRONTEND_URL}/pricing`;

  // HIGH-1: todo pago debe venir de un preapproval con external_reference
  // (pro_<userId>_<interval>). El flujo legacy de CHECKOUT_URLS genéricas sin
  // referencia se eliminó: permitía identificar el tier por monto en el webhook
  // (un pago de ~1/100 del precio otorgaba Pro).
  if (!planId) {
    throw new ValidationError('URL de pago no configurada para este plan');
  }

  const externalReference = `${data.tier}_${req.user!.userId}_${data.interval}`;
  const result = await mercadopagoService.createPreApproval({
    planId,
    payerEmail: req.user!.email,
    externalReference,
    successUrl,
    cancelUrl,
    reason: `Fiesta y Lista ${data.tier === 'pro_plus' ? 'Pro Plus' : 'Pro'} ${data.interval === 'year' ? 'Anual' : 'Mensual'}`,
  });
  res.json({ url: result.initPoint });
}));

router.post('/sync', requireAuth, apiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const sub = await subscriptionService.getCurrentSubscription(userId);
  if (sub && sub.status === 'active') {
    res.json({ tier: sub.tier, synced: false, message: `Ya tienes ${sub.tier === 'pro_plus' ? 'Pro Plus' : 'Pro'} activo` });
    return;
  }

  // M2: una suscripción cancelada NO se reactiva por sync — el usuario pidió
  // cancelar (o expiró); reactivar desde un pago viejo era un bug que revertía
  // la cancelación sin cancelar el preapproval en MP.
  if (sub && sub.status === 'canceled') {
    res.json({ tier: 'free', synced: false, message: 'Tu suscripción está cancelada. Suscríbete de nuevo para continuar.' });
    return;
  }

  const [payment] = await db
    .select({
      id: proPayments.id,
      userId: proPayments.userId,
      mpPaymentId: proPayments.mpPaymentId,
      status: proPayments.status,
      tier: proPayments.tier,
      interval: proPayments.interval,
      createdAt: proPayments.createdAt,
    })
    .from(proPayments)
    .where(and(
      eq(proPayments.userId, userId),
      eq(proPayments.status, 'completed'),
      sql`${proPayments.createdAt} >= NOW() - INTERVAL '37 days'`,
    ))
    .orderBy(desc(proPayments.createdAt))
    .limit(1);

  if (payment) {
    // Re-verificar con MP que el pago siga approved (previene reactivación post-reembolso)
    if (payment.mpPaymentId) {
      try {
        const mpInfo = await mercadopagoService.fetchPaymentInfo(payment.mpPaymentId);
        if (mpInfo.status === 'refunded' || mpInfo.status === 'charged_back') {
          await db
            .update(proPayments)
            .set({ status: 'refunded' })
            .where(eq(proPayments.id, payment.id))
            .catch(() => {});
          res.json({ tier: 'free', synced: false, message: 'Este pago fue reembolsado. Suscríbete de nuevo para continuar.' });
          return;
        }
      } catch (err) {
        log.error({ err, mpPaymentId: payment.mpPaymentId }, 'Error verificando pago con MP durante sync:');
      }
    }

    const periodDays = payment.interval === 'year' ? 365 : 30;
    const periodStart = payment.createdAt ?? new Date();
    const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000);

    if (periodEnd <= new Date()) {
      res.json({ tier: 'free', synced: false, message: 'Tu pago ya expiró. Suscríbete de nuevo para continuar.' });
      return;
    }

    const tier = payment.tier ?? 'pro';
    await subscriptionService.createOrUpdateSubscription(userId, {
      // M2: conservar el preapproval conocido (si existe) — escribir null borraba
      // la referencia y desactivaba los guards C2/A4 que comparan el preapproval.
      mpSubscriptionId: sub?.mpSubscriptionId ?? null,
      tier: tier as 'pro' | 'pro_plus',
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
    res.json({ tier, synced: true, message: 'Suscripción activada' });
    return;
  }

  // No local record found — search Mercado Pago directly (webhook recovery)
  const intervals = ['month', 'year'] as const;
  const tiers = ['pro', 'pro_plus'] as const;
  for (const tier of tiers) {
    for (const interval of intervals) {
      if (tier === 'pro_plus' && interval === 'year') continue;
      const ref = `${tier}_${userId}_${interval}`;
      try {
        const mpPayment = await mercadopagoService.searchPaymentsByRef(ref);
        if (!mpPayment) continue;
        await mpWebhooks.handlePaymentNotification(mpPayment.id);
        const [newPayment] = await db
          .select()
          .from(proPayments)
          .where(and(
            eq(proPayments.userId, userId),
            eq(proPayments.mpPaymentId, mpPayment.id),
          ))
          .limit(1);
        if (newPayment && newPayment.status !== 'refunded') {
          const periodDays = newPayment.interval === 'year' ? 365 : 30;
          const periodStart = newPayment.createdAt ?? new Date();
          const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000);
          if (periodEnd <= new Date()) continue;
          await subscriptionService.createOrUpdateSubscription(userId, {
            // M2: el webhook recovery (handlePaymentNotification) ya registró el
            // preapproval correcto — conservar el id existente, nunca sobrescribir con null.
            mpSubscriptionId: sub?.mpSubscriptionId ?? null,
            tier: newPayment.tier as 'pro' | 'pro_plus',
            status: 'active',
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          });
          res.json({ tier: newPayment.tier, synced: true, message: 'Suscripción activada desde Mercado Pago' });
          return;
        }
      } catch (err) {
        log.error({ err, ref }, 'Error buscando pago en MP durante sync:');
      }
    }
  }

  res.json({ tier: 'free', synced: false, message: 'No encontramos un pago reciente. Después de pagar, espera unos minutos y vuelve a intentar. Si el problema persiste, contacta a soporte.' });
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
    sendError(res, 400, 'No tienes una suscripción activa');
    return;
  }
  let mpSubscriptionId = sub.mpSubscriptionId;

  // Si no tenemos el ID localmente, intentar buscar el preapproval activo en MP
  if (!mpSubscriptionId) {
    const tier = sub.tier ?? 'pro';
    const interval = sub.currentPeriodEnd
      ? (sub.currentPeriodEnd.getTime() - (sub.currentPeriodStart?.getTime() ?? Date.now())) > 330 * 24 * 60 * 60 * 1000 ? 'year' : 'month'
      : 'month';
    const externalRef = `${tier}_${req.user!.userId}_${interval}`;
    const preapproval = await mercadopagoService.searchPreapprovalsByRef(externalRef);
    if (preapproval) {
      mpSubscriptionId = preapproval.id;
    }
  }

  await subscriptionService.cancelSubscription(req.user!.userId);

  if (mpSubscriptionId) {
    // D4: MP cancel con reintentos (3 intentos, backoff exponencial) —
    // antes era fire-and-forget sin retry: si fallaba, el usuario seguía
    // siendo cobrado mensualmente.
    mercadopagoService.retryable(
      () => mercadopagoService.cancelPreapproval(mpSubscriptionId),
      3,
      10000,
    ).then(() => {
      log.info({ userId: req.user!.userId, mpSubscriptionId }, 'Preapproval cancelado en MP');
    }).catch((err) => {
      log.error({ err, userId: req.user!.userId }, 'Error no crítico cancelando preapproval en MP — DB ya actualizada:');
    });
  } else {
    log.warn({ userId: req.user!.userId }, 'Intento de cancelación sin mpSubscriptionId — no se encontró preapproval en MP');
  }

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

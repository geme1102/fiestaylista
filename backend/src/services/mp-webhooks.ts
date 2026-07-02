import { eq, and, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users, proPayments, emailTracking } from '../db/schema.js';
import * as subscriptionService from './subscription.js';
import * as emailService from './email.js';
import { fetchPaymentInfo, fetchPreapprovalInfo } from './mercadopago.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('MP');

export async function handleProPayment(paymentId: string, userId: string, interval: string, tier: 'pro' | 'pro_plus'): Promise<void> {
  const periodDays = interval === 'year' ? 365 : 30;
  const isProPlus = tier === 'pro_plus';
  const expectedAmount = interval === 'year'
    ? (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS * 11 : config.PRO_YEARLY_PRICE_CENTS)
    : (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS : config.PRO_MONTHLY_PRICE_CENTS);

  await db.transaction(async (tx) => {
    const [existingPayment] = await tx
      .select({ id: proPayments.id })
      .from(proPayments)
      .where(eq(proPayments.mpPaymentId, paymentId))
      .limit(1);

    if (existingPayment) {
      log.info(`${tier.toUpperCase()} payment ${paymentId} already processed`);
      return;
    }

    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: null,
      tier,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
    }, tx as unknown as typeof db);
    await tx
      .insert(proPayments)
      .values({ userId, mpPaymentId: paymentId, amount: expectedAmount, interval, tier })
      .onConflictDoNothing();
  });

  try {
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user) {
      const period = interval === 'year' ? 'anual' : 'mensual';
      if (isProPlus) {
        emailService.sendRawEmail({
          from: config.FROM_EMAIL,
          to: user.email,
          subject: '¡Bienvenido a Fiesta y Lista PRO Plus! 🚀',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <div style="text-align:center;margin-bottom:16px">
                <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#8b5cf6,#ec4899);width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
                <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
              </div>
              <h1 style="text-align:center;color:#1f2937;font-size:20px">¡Bienvenido a PRO Plus, ${user.name}!</h1>
              <p style="color:#6b7280;text-align:center;margin:16px 0">Tu suscripción ${period} ya está activa. Ahora tienes acceso a todas las funciones premium con más espacio para tus eventos.</p>
              <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;margin:16px 0">
                <p style="margin:0;color:#5b21b6;font-size:14px"><strong>Qué incluye:</strong></p>
                <ul style="margin:8px 0 0;padding-left:20px;color:#5b21b6;font-size:14px">
                  <li>3 eventos</li>
                  <li>100 regalos por evento</li>
                  <li>20 fotos por evento</li>
                  <li>Lluvia de Sobres: tus invitados reportan sus aportes</li>
                </ul>
              </div>
              <div style="text-align:center;margin:24px 0">
                <a href="${config.FRONTEND_URL}/dashboard" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:white;text-decoration:none;border-radius:12px;font-weight:600">Ir al dashboard</a>
              </div>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
              <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
            </div>
          `,
        }).catch((err) => log.error({ err }, `Error enviando email de confirmación PRO Plus para ${userId}:`));
      } else {
        const periodLabel = interval === 'year' ? 'anual' : 'mensual';
        emailService.sendProConfirmationEmail(user.email, user.name, periodLabel)
          .catch((err) => log.error({ err }, `Error enviando email de confirmación PRO para ${userId}:`));
      }
    }
  } catch (err) {
    log.error({ err }, `Error enviando email de confirmación para ${userId}:`);
  }
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user?.id ?? null;
}

function detectTierFromAmount(amount: number): { tier: 'pro' | 'pro_plus'; interval: 'month' | 'year' } | null {
  // MP puede enviar montos como 59900 en enteros o 599.00 en decimales (pesos).
  // Normalizar: si el monto es < 10000, asumir que está en unidades (multiplicar por 100).
  const normalized = amount < 10000 ? Math.round(amount * 100) : Math.round(amount);

  const proMonthly = config.PRO_MONTHLY_PRICE_CENTS;
  const proYearly = config.PRO_YEARLY_PRICE_CENTS;
  const proPlusMonthly = config.PRO_PLUS_MONTHLY_PRICE_CENTS;

  const diff = (a: number, b: number) => Math.abs(a - b);
  const closeEnough = (a: number, b: number) => diff(a, b) <= 1 || diff(a, b) / Math.max(a, b) < 0.01;

  if (closeEnough(normalized, proMonthly)) return { tier: 'pro', interval: 'month' };
  if (closeEnough(normalized, proYearly)) return { tier: 'pro', interval: 'year' };
  if (closeEnough(normalized, proPlusMonthly)) return { tier: 'pro_plus', interval: 'month' };

  return null;
}

export async function handlePaymentNotification(paymentId: string): Promise<void> {
  const info = await fetchPaymentInfo(paymentId);
  const ref = info.externalReference;

  if (ref && ref.startsWith('pro_')) {
    const isProPlus = ref.startsWith('pro_plus_');
    if (info.status === 'approved') {
      const parts = ref.split('_');
      const tier = isProPlus ? 'pro_plus' : 'pro';
      const userId = parts[isProPlus ? 2 : 1];
      const interval = parts[isProPlus ? 3 : 2] || 'month';
      if (!userId || !/^(month|year)$/.test(interval)) return;
      const expectedAmount = interval === 'year'
        ? (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS * 11 : config.PRO_YEARLY_PRICE_CENTS)
        : (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS : config.PRO_MONTHLY_PRICE_CENTS);
      const diff = Math.abs(info.transactionAmount - expectedAmount);
      if (diff > 1 && diff / expectedAmount > 0.01) {
        log.error(`Monto de ${tier.toUpperCase()} inválido: esperado ${expectedAmount}, recibido ${info.transactionAmount}`);
        return;
      }
      await handleProPayment(paymentId, userId, interval, tier);
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      const parts = ref.split('_');
      const userId = parts[isProPlus ? 2 : 1];
      if (userId) await subscriptionService.cancelSubscription(userId, true);
    }
    return;
  }

  if (info.status === 'refunded' || info.status === 'charged_back') {
    if (info.payerEmail) {
      const userId = await findUserIdByEmail(info.payerEmail);
      if (userId) await subscriptionService.cancelSubscription(userId, true);
    }
    return;
  }

  if (info.status !== 'approved') return;

  if (!info.payerEmail) {
    log.error({ paymentId }, 'Pago sin email de pagador — no se puede identificar al usuario');
    return;
  }

  const detected = detectTierFromAmount(info.transactionAmount);
  if (!detected) {
    log.error({ paymentId, amount: info.transactionAmount }, 'Monto de pago no coincide con ningún plan conocido');
    return;
  }

  const userId = await findUserIdByEmail(info.payerEmail);
  if (!userId) {
    log.error({ email: info.payerEmail }, 'Usuario no encontrado para el email del pagador');
    return;
  }

  await handleProPayment(paymentId, userId, detected.interval, detected.tier);
}

export async function handleSubscriptionNotification(preapprovalId: string): Promise<void> {
  const info = await fetchPreapprovalInfo(preapprovalId);
  let userId: string | null = info.externalReference;

  if (!userId) {
    if (!info.payerEmail) {
      log.error({ preapprovalId }, 'Preapproval sin external_reference ni payer_email — no se puede identificar al usuario');
      return;
    }
    userId = await findUserIdByEmail(info.payerEmail);
    if (!userId) {
      log.error({ email: info.payerEmail }, 'Usuario no encontrado para el email del pagador en preapproval');
      return;
    }
  }

  const detected = detectTierFromAmount(info.transactionAmount);
  if (!detected) {
    log.error({ preapprovalId, amount: info.transactionAmount }, 'Monto de suscripción no coincide con ningún plan conocido');
    return;
  }
  const detectedTier = detected.tier;
  const detectedInterval = detected.interval;
  const periodDays = detectedInterval === 'year' ? 365 : 30;

  if (info.status === 'active') {
    const currentSub = await subscriptionService.getCurrentSubscription(userId);

    if (currentSub && currentSub.status === 'canceled' && !currentSub.mpSubscriptionId) {
      log.warn({ userId }, 'Ignorando webhook tardío — suscripción cancelada manualmente');
      return;
    }

    const currentPeriodEnd = info.nextChargeDate
      ? new Date(info.nextChargeDate)
      : new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
    const currentPeriodStart = info.dateCreated
      ? new Date(info.dateCreated)
      : new Date();

    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: preapprovalId,
      tier: detectedTier,
      status: 'active',
      currentPeriodStart,
      currentPeriodEnd,
    });
  } else if (info.status === 'authorized') {
    const currentPeriodStart = info.dateCreated
      ? new Date(info.dateCreated)
      : new Date();
    const currentPeriodEnd = info.nextChargeDate
      ? new Date(info.nextChargeDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: preapprovalId,
      tier: detectedTier,
      status: 'pending_approval',
      currentPeriodStart,
      currentPeriodEnd,
    });
  } else if (info.status === 'cancelled') {
    await subscriptionService.cancelSubscription(userId);
  } else if (info.status === 'past_due') {
    await subscriptionService.updateSubscriptionStatus(userId, 'past_due');

    const [pastDueUser] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (pastDueUser?.email) {
      // Dedup: solo enviar email de past_due una vez por ciclo de suscripción
      const [recentEmail] = await db
        .select({ id: emailTracking.id })
        .from(emailTracking)
        .where(and(
          eq(emailTracking.userId, userId),
          eq(emailTracking.type, 'past_due'),
          sql`${emailTracking.sentAt} > NOW() - INTERVAL '7 days'`,
        ))
        .limit(1);

      if (!recentEmail) {
        emailService.sendPastDueEmail(pastDueUser.email, pastDueUser.name, 7, `${config.FRONTEND_URL}/account`).catch((err: Error) => {
          log.error({ err, userId }, 'Error enviando email de past_due:');
        });
        db.insert(emailTracking).values({ userId, type: 'past_due' }).catch((err: Error) => {
          log.error({ err, userId }, 'Error registrando tracking de past_due:');
        });
      }
    }
  }
}

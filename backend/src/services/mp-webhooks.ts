import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users, proPayments } from '../db/schema.js';
import * as subscriptionService from './subscription.js';
import * as emailService from './email.js';
import { fetchPaymentInfo, fetchPreapprovalInfo } from './mercadopago.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('MP');

export async function handleProPayment(paymentId: string, userId: string, interval: string): Promise<void> {
  const periodDays = interval === 'year' ? 365 : 30;
  const expectedAmount = interval === 'year' ? config.PRO_YEARLY_PRICE_CENTS : config.PRO_MONTHLY_PRICE_CENTS;

  let isFirstProcessing = true;

  await db.transaction(async (tx) => {
    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: null,
      tier: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
    }, tx as unknown as typeof db);

    try {
      await tx
        .insert(proPayments)
        .values({ userId, mpPaymentId: paymentId, amount: expectedAmount, interval });
    } catch (err: unknown) {
      if ((err as Record<string, unknown>)?.code === '23505') {
        log.info(`PRO payment ${paymentId} already processed`);
        isFirstProcessing = false;
        return;
      }
      throw err;
    }
  });

  if (!isFirstProcessing) return;

  try {
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user) {
      const period = interval === 'year' ? 'anual' : 'mensual';
      emailService.sendProConfirmationEmail(user.email, user.name, period)
        .catch((err) => log.error({ err }, `Error enviando email de confirmación PRO para ${userId}:`));
    }
  } catch (err) {
    log.error({ err }, `Error enviando email de confirmación PRO para ${userId}:`);
  }
}

export async function handlePaymentNotification(paymentId: string): Promise<void> {
  const info = await fetchPaymentInfo(paymentId);
  const ref = info.externalReference;

  if (!ref) return;

  if (ref.startsWith('pro_')) {
    if (info.status === 'approved') {
      const parts = ref.split('_');
      const userId = parts[1];
      const interval = parts[2] || 'month';
      if (!userId || !/^(month|year)$/.test(interval)) return;
      const expectedAmount = interval === 'year' ? config.PRO_YEARLY_PRICE_CENTS : config.PRO_MONTHLY_PRICE_CENTS;
      const diff = Math.abs(info.transactionAmount - expectedAmount);
      if (diff > 1 && diff / expectedAmount > 0.01) {
        log.error(`Monto de PRO inválido: esperado ${expectedAmount}, recibido ${info.transactionAmount}`);
        return;
      }
      await handleProPayment(paymentId, userId, interval);
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      const parts = ref.split('_');
      const userId = parts[1];
      if (userId) await subscriptionService.cancelSubscription(userId, true);
    }
  }
}

export async function handleSubscriptionNotification(preapprovalId: string): Promise<void> {
  const info = await fetchPreapprovalInfo(preapprovalId);
  const userId = info.externalReference;

  if (!userId) return;

  if (info.status === 'active') {
    const isYearly = info.reason?.toLowerCase().includes('anual');
    const periodDays = isYearly ? 365 : 30;
    const currentPeriodEnd = info.nextChargeDate
      ? new Date(info.nextChargeDate)
      : new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
    const currentPeriodStart = info.dateCreated
      ? new Date(info.dateCreated)
      : new Date();

    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: preapprovalId,
      tier: 'pro',
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
      tier: 'pro',
      status: 'pending_approval',
      currentPeriodStart,
      currentPeriodEnd,
    });
  } else if (info.status === 'cancelled') {
    await subscriptionService.cancelSubscription(userId);
  } else if (info.status === 'past_due') {
    await subscriptionService.cancelSubscription(userId, true);
  }
}

import { and, eq, ne, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { events, users, boostPayments, proPayments, cashContributions, cashFunds } from '../db/schema.js';
import * as subscriptionService from './subscription.js';
import * as cashFundService from './cashFund.js';
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
    }, tx);

    try {
      await tx
        .insert(proPayments)
        .values({ userId, mpPaymentId: paymentId, amount: expectedAmount, interval });
    } catch (err: any) {
      if (err?.code === '23505') {
        log.info(`PRO payment ${paymentId} already processed`);
        isFirstProcessing = false;
        return;
      }
      throw err;
    }
  });

  if (!isFirstProcessing) {
    const [existing] = await db
      .select({ id: proPayments.id })
      .from(proPayments)
      .where(eq(proPayments.mpPaymentId, paymentId))
      .limit(1);
    if (!existing) return;
  }

  try {
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user) {
      const period = interval === 'year' ? 'anual' : 'mensual';
      await emailService.sendProConfirmationEmail(user.email, user.name, period);
    }
  } catch (err) {
    log.error({ err }, `Error enviando email de confirmación PRO para ${userId}:`);
  }
}

async function handleBoostPayment(paymentId: string, ref: string): Promise<void> {
  const eventId = ref.slice(6);
  if (!eventId) return;

  const result = await db.transaction(async (tx) => {
    try {
      await tx
        .insert(boostPayments)
        .values({ eventId, mpPaymentId: paymentId, amount: config.BOOST_PRICE_CENTS });
    } catch (err: any) {
      if (err?.code === '23505') {
        log.info(`Boost payment ${paymentId} already processed`);
        return null;
      }
      throw err;
    }

    await tx
      .update(events)
      .set({
        boostedUntil: sql`GREATEST(COALESCE(${events.boostedUntil}, NOW()), NOW()) + INTERVAL '30 days'`,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    return true;
  });

  if (result) {
    await db
      .insert(cashFunds)
      .values({ eventId, title: 'Lluvia de sobres', isActive: true })
      .onConflictDoNothing({ target: cashFunds.eventId });
  }
}

async function revertBoostPayment(paymentId: string, ref: string): Promise<void> {
  const eventId = ref.slice(6);
  if (!eventId) return;

  const [payment] = await db
    .update(boostPayments)
    .set({ status: 'refunded' })
    .where(and(
      eq(boostPayments.mpPaymentId, paymentId),
      ne(boostPayments.status, 'refunded'),
    ))
    .returning({ id: boostPayments.id });

  if (!payment) return;

  await db
    .update(events)
    .set({
      boostedUntil: sql`CASE
        WHEN ${events.boostedUntil} IS NULL OR ${events.boostedUntil} <= NOW() THEN NULL
        WHEN ${events.boostedUntil} - INTERVAL '30 days' <= NOW() THEN NULL
        ELSE ${events.boostedUntil} - INTERVAL '30 days'
      END`,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));
}

export async function handlePaymentNotification(paymentId: string): Promise<void> {
  const info = await fetchPaymentInfo(paymentId);
  const ref = info.externalReference;

  if (!ref) return;

  if (ref.startsWith('boost_')) {
    if (info.status === 'approved') {
      const diff = Math.abs(info.transactionAmount - config.BOOST_PRICE_CENTS);
      if (diff > 1 && diff / config.BOOST_PRICE_CENTS > 0.01) {
        log.error(`Monto de boost inválido: esperado ${config.BOOST_PRICE_CENTS}, recibido ${info.transactionAmount}`);
        return;
      }
      await handleBoostPayment(paymentId, ref);
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      await revertBoostPayment(paymentId, ref);
    }
  } else if (ref.startsWith('pro_')) {
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
  } else {
    if (info.status === 'approved') {
      const [contribution] = await db
        .select({ amount: cashContributions.amount })
        .from(cashContributions)
        .where(eq(cashContributions.id, ref))
        .limit(1);

      if (contribution) {
        const diff = Math.abs(info.transactionAmount - contribution.amount);
        if (diff > 1 && diff / contribution.amount > 0.01) {
          log.error(`Monto de contribución inválido: esperado ${contribution.amount}, recibido ${info.transactionAmount}`);
          return;
        }
      } else {
        log.warn(`Contribución no encontrada para ref: ${ref}, paymentId: ${paymentId}`);
      }
      await cashFundService.completeContribution(ref, paymentId);
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      await cashFundService.revertContribution(ref);
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
    await subscriptionService.cancelSubscription(userId);
  }
}

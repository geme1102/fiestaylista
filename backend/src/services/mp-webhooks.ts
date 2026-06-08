import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { events, boostPayments, cashContributions } from '../db/schema.js';
import * as subscriptionService from './subscription.js';
import * as cashFundService from './cashFund.js';
import { fetchPaymentInfo, fetchPreapprovalInfo } from './mercadopago.js';

async function handleBoostPayment(paymentId: string, ref: string): Promise<void> {
  const eventId = ref.slice(6);
  if (!eventId) return;

  await db.transaction(async (tx) => {
    const [existingPayment] = await tx
      .select({ id: boostPayments.id })
      .from(boostPayments)
      .where(eq(boostPayments.mpPaymentId, paymentId))
      .limit(1);

    if (existingPayment) {
      console.log(`[MP] Boost payment ${paymentId} already processed`);
      return;
    }

    const [event] = await tx
      .select({ id: events.id, boostedUntil: events.boostedUntil })
      .from(events)
      .where(eq(events.id, eventId))
      .for('update')
      .limit(1);

    if (!event) return;

    await tx
      .insert(boostPayments)
      .values({ eventId, mpPaymentId: paymentId, amount: config.BOOST_PRICE_CENTS });

    const now = Date.now();
    const currentBoost = event.boostedUntil?.getTime() ?? 0;
    const remaining = Math.max(0, currentBoost - now);
    const boostDuration = 30 * 24 * 60 * 60 * 1000;
    const boostedUntil = new Date(now + remaining + boostDuration);

    await tx
      .update(events)
      .set({ boostedUntil, updatedAt: new Date() })
      .where(eq(events.id, eventId));
  });
}

async function revertBoostPayment(paymentId: string, ref: string): Promise<void> {
  const eventId = ref.slice(6);
  if (!eventId) return;

  const [payment] = await db
    .select({ id: boostPayments.id })
    .from(boostPayments)
    .where(eq(boostPayments.mpPaymentId, paymentId))
    .limit(1);

  if (!payment) return;

  await db.transaction(async (tx) => {
    const [event] = await tx
      .select({ id: events.id, boostedUntil: events.boostedUntil })
      .from(events)
      .where(eq(events.id, eventId))
      .for('update')
      .limit(1);

    if (!event) return;

    const now = Date.now();
    const currentBoost = event.boostedUntil?.getTime() ?? 0;
    const remaining = Math.max(0, currentBoost - now);
    const reducedBoost = Math.max(0, remaining - 30 * 24 * 60 * 60 * 1000);
    const newBoostedUntil = reducedBoost > 0 ? new Date(now + reducedBoost) : null;

    await tx
      .update(events)
      .set({ boostedUntil: newBoostedUntil, updatedAt: new Date() })
      .where(eq(events.id, eventId));

    await tx
      .update(boostPayments)
      .set({ status: 'refunded' })
      .where(eq(boostPayments.mpPaymentId, paymentId));
  });
}

export async function handlePaymentNotification(paymentId: string): Promise<void> {
  const info = await fetchPaymentInfo(paymentId);
  const ref = info.externalReference;

  if (!ref) return;

  if (ref.startsWith('boost_')) {
    if (info.status === 'approved') {
      if (Math.abs(info.transactionAmount - config.BOOST_PRICE_CENTS) > 1) {
        console.error(`[MP] Monto de boost inválido: esperado ${config.BOOST_PRICE_CENTS}, recibido ${info.transactionAmount}`);
        return;
      }
      await handleBoostPayment(paymentId, ref);
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      await revertBoostPayment(paymentId, ref);
    }
  } else {
    if (info.status === 'approved') {
      const [contribution] = await db
        .select({ amount: cashContributions.amount })
        .from(cashContributions)
        .where(eq(cashContributions.id, ref))
        .limit(1);

      if (contribution && Math.abs(info.transactionAmount - contribution.amount) > 1) {
        console.error(`[MP] Monto de contribución inválido: esperado ${contribution.amount}, recibido ${info.transactionAmount}`);
        return;
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

  if (info.status === 'authorized' || info.status === 'active') {
    const isYearly = info.reason?.toLowerCase().includes('anual');
    const periodDays = isYearly ? 365 : 30;
    const currentPeriodEnd = info.nextChargeDate
      ? new Date(info.nextChargeDate)
      : new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: preapprovalId,
      tier: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd,
    });
  } else if (info.status === 'cancelled' || info.status === 'past_due') {
    await subscriptionService.cancelSubscription(userId);
  }
}

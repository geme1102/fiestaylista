import { eq } from 'drizzle-orm';
import { MercadoPagoConfig, Preference, Payment, PreApproval } from 'mercadopago';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { events, boostPayments } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import * as subscriptionService from './subscription.js';
import * as cashFundService from './cashFund.js';
import type { Tier, SubscriptionStatus } from '../types/index.js';

let client: MercadoPagoConfig | null = null;

if (config.MERCADO_PAGO_ACCESS_TOKEN) {
  client = new MercadoPagoConfig({ accessToken: config.MERCADO_PAGO_ACCESS_TOKEN });
}

const PLAN_MAP: Record<Tier, { month: string; year: string }> = {
  free: { month: '', year: '' },
  pro: { month: config.MERCADO_PAGO_PRO_MONTHLY_PLAN_ID, year: config.MERCADO_PAGO_PRO_YEARLY_PLAN_ID },
};

function getPlanId(tier: Tier, interval: 'month' | 'year'): string {
  const plans = PLAN_MAP[tier];
  if (!plans) throw new NotFoundError('Plan no encontrado');
  const planId = plans[interval];
  if (!planId) throw new NotFoundError('El plan gratuito no requiere suscripción');
  return planId;
}

async function retryable<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: Tier,
  interval: 'month' | 'year',
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado (falta MERCADO_PAGO_ACCESS_TOKEN)');
  }

  const planId = getPlanId(tier, interval);
  const label = tier === 'pro' ? 'Pro' : 'Free';
  const reason = `${label} ${interval === 'month' ? 'Mensual' : 'Anual'} - Fiesta y Lista`;

  const preapproval = new PreApproval(client);
  const result = await retryable(() => preapproval.create({
    body: {
      preapproval_plan_id: planId,
      payer_email: email,
      back_url: successUrl,
      external_reference: userId,
      reason,
      status: 'authorized',
    } as any,
  }));

  const initPoint = result.init_point;
  if (!initPoint) {
    throw new Error('No se pudo generar la URL de pago');
  }

  return { url: initPoint };
}

export async function createContributionPreference(
  contributionId: string,
  contributorName: string,
  amountInCents: number,
  cashFundTitle: string,
  backUrl: string,
): Promise<{ redirectUrl: string }> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado (falta MERCADO_PAGO_ACCESS_TOKEN)');
  }

  const preference = new Preference(client);
  const result = await retryable(() => preference.create({
    body: {
      items: [{
        id: `contrib_${contributionId}`,
        title: cashFundTitle || 'Contribución - Lluvia de Sobres',
        quantity: 1,
        unit_price: amountInCents,
        currency_id: 'COP',
      }],
      payer: { name: contributorName },
      back_urls: {
        success: backUrl,
        failure: backUrl,
        pending: backUrl,
      },
      auto_return: 'approved',
      notification_url: `${config.BACKEND_URL}/api/webhooks/mercadopago`,
      external_reference: contributionId,
    },
  }));

  const initPoint = result.init_point;
  if (!initPoint) {
    throw new Error('No se pudo generar la URL de pago');
  }

  return { redirectUrl: initPoint };
}

export async function createBoostPreference(
  eventId: string,
  userId: string,
  successUrl: string,
): Promise<{ url: string }> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado (falta MERCADO_PAGO_ACCESS_TOKEN)');
  }

  const preference = new Preference(client);
  const result = await retryable(() => preference.create({
    body: {
      items: [{
        id: `boost_${eventId}`,
        title: 'Boost de evento - Fiesta y Lista',
        quantity: 1,
        unit_price: 49900,
        currency_id: 'COP',
      }],
      back_urls: {
        success: successUrl,
        failure: successUrl,
        pending: successUrl,
      },
      auto_return: 'approved',
      notification_url: `${config.BACKEND_URL}/api/webhooks/mercadopago`,
      external_reference: `boost_${eventId}`,
    },
  }));

  const initPoint = result.init_point;
  if (!initPoint) {
    throw new Error('No se pudo generar la URL de pago');
  }

  return { url: initPoint };
}

export async function fetchPaymentInfo(paymentId: string): Promise<{
  status: string;
  externalReference: string;
  transactionAmount: number;
  payerName: string;
}> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const payment = new Payment(client);
  const info = await retryable(() => payment.get({ id: paymentId }));

  return {
    status: info.status ?? 'unknown',
    externalReference: info.external_reference ?? '',
    transactionAmount: info.transaction_amount ?? 0,
    payerName: info.payer?.first_name ?? '',
  };
}

export async function fetchPreapprovalInfo(preapprovalId: string): Promise<{
  status: string;
  externalReference: string;
  payerEmail: string;
  reason: string;
}> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  const info = await retryable(() => preapproval.get({ id: preapprovalId }));

  return {
    status: info.status ?? 'unknown',
    externalReference: info.external_reference ?? '',
    payerEmail: info.payer_email ?? '',
    reason: info.reason ?? '',
  };
}

export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  await retryable(() => preapproval.update({ id: preapprovalId, body: { status: 'cancelled' } }));
}

async function handleBoostPayment(paymentId: string, ref: string): Promise<void> {
  const eventId = ref.slice(6);
  if (!eventId) return;

  const [existingPayment] = await db
    .select({ id: boostPayments.id })
    .from(boostPayments)
    .where(eq(boostPayments.mpPaymentId, paymentId))
    .limit(1);

  if (existingPayment) return;

  await db.transaction(async (tx) => {
    const [existingCheck] = await tx
    .select({ id: boostPayments.id })
    .from(boostPayments)
    .where(eq(boostPayments.mpPaymentId, paymentId))
    .limit(1);

    if (existingCheck) return;

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
    const boostDuration = 30 * 24 * 60 * 60 * 1000;
    const boostedUntil = new Date(now + remaining + boostDuration);

    await tx
      .update(events)
      .set({ boostedUntil, updatedAt: new Date() })
      .where(eq(events.id, eventId));

    await tx
      .insert(boostPayments)
      .values({ eventId, mpPaymentId: paymentId, amount: 49900 });
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
  });
}

export async function handlePaymentNotification(paymentId: string): Promise<void> {
  const info = await fetchPaymentInfo(paymentId);
  const ref = info.externalReference;

  if (!ref) return;

  if (ref.startsWith('boost_')) {
    if (info.status === 'approved') {
      await handleBoostPayment(paymentId, ref);
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      await revertBoostPayment(paymentId, ref);
    }
  } else {
    if (info.status === 'approved') {
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
    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId: preapprovalId,
      tier: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
    });
  } else if (info.status === 'cancelled' || info.status === 'past_due') {
    await subscriptionService.cancelSubscription(userId);
  }
}

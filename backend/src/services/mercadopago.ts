import { MercadoPagoConfig, Preference, Payment, PreApproval } from 'mercadopago';
import { config } from '../config.js';
import type { Tier } from '../types/index.js';

let client: MercadoPagoConfig | null = null;

if (config.MERCADO_PAGO_ACCESS_TOKEN) {
  client = new MercadoPagoConfig({ accessToken: config.MERCADO_PAGO_ACCESS_TOKEN });
}

function getPrice(tier: Tier, interval: 'month' | 'year'): number {
  if (tier === 'pro') {
    return interval === 'month' ? config.PRO_MONTHLY_PRICE_CENTS : config.PRO_YEARLY_PRICE_CENTS;
  }
  return 0;
}

export function serializeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    const message = obj.message ?? JSON.stringify(obj);
    const err = new Error(String(message));
    if (typeof obj.status === 'number') (err as any).status = obj.status;
    if (typeof obj.cause !== 'undefined') (err as any).cause = obj.cause;
    try { (err as any).raw = JSON.stringify(obj); } catch { /* ignore */ }
    return err;
  }
  return new Error(String(error));
}

export async function retryable<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MP request timed out')), 15000),
        ),
      ]);
      return result;
    } catch (error) {
      lastError = serializeError(error);
      const status = (error as any)?.status;
      if (status !== undefined && status < 500) {
        throw lastError;
      }
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
  _cancelUrl: string,
): Promise<{ url: string }> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado (falta MERCADO_PAGO_ACCESS_TOKEN)');
  }

  const amount = getPrice(tier, interval);
  const reason = `Pro ${interval === 'month' ? 'Mensual' : 'Anual'} - Fiesta y Lista`;

  const preapproval = new PreApproval(client);
  const result = await retryable(() => preapproval.create({
    body: {
      payer_email: email,
      back_url: successUrl,
      external_reference: userId,
      reason,
      notification_url: `${config.BACKEND_URL}/api/webhooks/mercadopago`,
      auto_recurring: {
        frequency: 1,
        frequency_type: interval === 'month' ? 'months' : 'years',
        transaction_amount: amount,
        currency_id: 'COP',
      },
      status: 'pending',
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
  _userId: string,
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
        unit_price: config.BOOST_PRICE_CENTS,
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
  nextChargeDate: string | null;
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
    nextChargeDate: (info as any).next_charge_date || (info as any).scheduled_date || null,
  };
}

export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  await retryable(() => preapproval.update({ id: preapprovalId, body: { status: 'cancelled' } }));
}

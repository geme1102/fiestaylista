import { MercadoPagoConfig, Preference, Payment, PreApproval } from 'mercadopago';
import { config } from '../config.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('MP');

let client: MercadoPagoConfig | null = null;

if (config.MERCADO_PAGO_ACCESS_TOKEN) {
  client = new MercadoPagoConfig({ accessToken: config.MERCADO_PAGO_ACCESS_TOKEN });
}

export function mpNotificationUrl(): string {
  const base = config.BACKEND_URL
    .replace(/\/+$/, '')
    .replace(/^([a-zA-Z]+:\/\/)?/, (_, proto) => proto || 'https://');
  return `${base}/api/webhooks/mercadopago`;
}

export function serializeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    const message = obj.message ?? JSON.stringify(obj);
    const err = new Error(String(message)) as Error & Record<string, unknown>;
    if (typeof obj.status === 'number') err.status = obj.status;
    if (typeof obj.cause !== 'undefined') err.cause = obj.cause;
    try { err.raw = JSON.stringify(obj); } catch { /* ignore */ }
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
      const status = (error as Record<string, unknown>)?.status;
      if (status !== undefined && (status as number) < 500) {
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

export async function createProPreference(
  userId: string,
  interval: 'month' | 'year',
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado (falta MERCADO_PAGO_ACCESS_TOKEN)');
  }

  const amount = interval === 'month' ? config.PRO_MONTHLY_PRICE_CENTS : config.PRO_YEARLY_PRICE_CENTS;
  const preference = new Preference(client);
  const result = await retryable(() => preference.create({
    body: {
      items: [{
        id: `pro_${userId}_${interval}`,
        title: `Pro ${interval === 'month' ? 'Mensual' : 'Anual'} - Fiesta y Lista`,
        quantity: 1,
        unit_price: amount,
        currency_id: 'COP',
      }],
      back_urls: {
        success: successUrl,
        failure: cancelUrl,
        pending: `${cancelUrl}?payment=pending`,
      },
      auto_return: 'approved',
      external_reference: `pro_${userId}_${interval}`,
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

export async function searchPaymentsByRef(externalReference: string): Promise<{
  id: string;
  status: string;
  transactionAmount: number;
} | null> {
  if (!client) return null;

  try {
    const result = await retryable(async () => {
      const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&limit=5`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.MERCADO_PAGO_ACCESS_TOKEN}` },
      });
      if (!res.ok) throw new Error(`MP API error: ${res.status}`);
      return res.json() as Promise<{ results: Array<{ id: number; status: string; transaction_amount: number }> }>;
    });

    const results = result?.results ?? [];
    const approved = results.find((p) => p.status === 'approved');
    if (!approved) return null;

    return {
      id: String(approved.id),
      status: approved.status,
      transactionAmount: approved.transaction_amount,
    };
  } catch (err) {
    log.error({ err }, 'Error searching payments by ref:');
    return null;
  }
}

export async function fetchPreapprovalInfo(preapprovalId: string): Promise<{
  status: string;
  externalReference: string;
  payerEmail: string;
  reason: string;
  nextChargeDate: string | null;
  dateCreated: string | null;
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
    nextChargeDate: (info as unknown as Record<string, unknown>).next_charge_date as string || (info as unknown as Record<string, unknown>).scheduled_date as string || null,
    dateCreated: (info as unknown as Record<string, unknown>).date_created as string || null,
  };
}

export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  await retryable(() => preapproval.update({ id: preapprovalId, body: { status: 'cancelled' } }));
}

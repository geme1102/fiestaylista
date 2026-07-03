import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
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

export async function retryable<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  maxRetries = 2,
  timeoutMs = 10000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fn(controller.signal);
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
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError!;
}

export async function fetchPaymentInfo(paymentId: string): Promise<{
  status: string;
  externalReference: string;
  transactionAmount: number;
  payerName: string;
  payerEmail: string;
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
    payerEmail: info.payer?.email ?? '',
  };
}

export async function searchPaymentsByRef(externalReference: string): Promise<{
  id: string;
  status: string;
  transactionAmount: number;
} | null> {
  if (!client) return null;

  try {
    const result = await retryable(async (signal) => {
      const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&limit=5`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.MERCADO_PAGO_ACCESS_TOKEN}` },
        signal,
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
  transactionAmount: number;
  nextChargeDate: string | null;
  dateCreated: string | null;
}> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  const info = await retryable(() => preapproval.get({ id: preapprovalId }));

  const autoRecurring = (info as unknown as Record<string, unknown>).auto_recurring as Record<string, unknown> | undefined;

  return {
    status: info.status ?? 'unknown',
    externalReference: info.external_reference ?? '',
    payerEmail: info.payer_email ?? '',
    reason: info.reason ?? '',
    transactionAmount: (info as unknown as Record<string, unknown>).initial_amount as number ?? autoRecurring?.transaction_amount as number ?? 0,
    nextChargeDate: (info as unknown as Record<string, unknown>).next_charge_date as string || (info as unknown as Record<string, unknown>).scheduled_date as string || null,
    dateCreated: (info as unknown as Record<string, unknown>).date_created as string || null,
  };
}

export async function createPreApproval(opts: {
  planId: string;
  payerEmail: string;
  externalReference: string;
  successUrl: string;
  cancelUrl: string;
  reason: string;
}): Promise<{ initPoint: string; preapprovalId: string }> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  const result = await retryable(() => preapproval.create({
    body: {
      preapproval_plan_id: opts.planId,
      payer_email: opts.payerEmail,
      external_reference: opts.externalReference,
      back_url: opts.successUrl,
      status: 'pending',
      reason: opts.reason,
    },
  }));

  return {
    initPoint: result.init_point ?? '',
    preapprovalId: result.id ?? '',
  };
}

export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  await retryable(() => preapproval.update({ id: preapprovalId, body: { status: 'cancelled' } }));
}

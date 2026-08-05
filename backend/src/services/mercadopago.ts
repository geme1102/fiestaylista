import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import { config } from '../config.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('MP');

let client: MercadoPagoConfig | null = null;

if (config.MERCADO_PAGO_ACCESS_TOKEN) {
  client = new MercadoPagoConfig({ accessToken: config.MERCADO_PAGO_ACCESS_TOKEN });
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
  fn: (opts: { signal: AbortSignal; timeout: number }) => Promise<T>,
  maxRetries = 2,
  timeoutMs = 10000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fn({ signal: controller.signal, timeout: timeoutMs });
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
  preapprovalId: string | null;
}> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const payment = new Payment(client);
  const info = await retryable((opts) => payment.get({ id: paymentId, requestOptions: { timeout: opts.timeout } }));

  return {
    status: info.status ?? 'unknown',
    externalReference: info.external_reference ?? '',
    transactionAmount: info.transaction_amount ?? 0,
    payerName: info.payer?.first_name ?? '',
    payerEmail: info.payer?.email ?? '',
    preapprovalId: (info as unknown as Record<string, unknown>).preapproval_id as string || null,
  };
}

export async function searchPaymentsByRef(externalReference: string): Promise<{
  id: string;
  status: string;
  transactionAmount: number;
} | null> {
  if (!client) return null;

  try {
    const result = await retryable(async (opts) => {
      const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&limit=5`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.MERCADO_PAGO_ACCESS_TOKEN}` },
        signal: opts.signal,
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
  // 'initial' cuando MP reporta el cobro inicial (validable contra el precio
  // del plan); 'recurring' cuando solo hay auto_recurring (monto mensual — para
  // planes anuales NO coincide con el precio anual, no debe validarse).
  amountSource: 'initial' | 'recurring';
  nextChargeDate: string | null;
  dateCreated: string | null;
}> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  const info = await retryable((opts) => preapproval.get({ id: preapprovalId, requestOptions: { timeout: opts.timeout } }));

  const autoRecurring = (info as unknown as Record<string, unknown>).auto_recurring as Record<string, unknown> | undefined;
  const initialAmount = (info as unknown as Record<string, unknown>).initial_amount as number | undefined;

  return {
    status: info.status ?? 'unknown',
    externalReference: info.external_reference ?? '',
    payerEmail: info.payer_email ?? '',
    reason: info.reason ?? '',
    transactionAmount: initialAmount ?? autoRecurring?.transaction_amount as number ?? 0,
    amountSource: typeof initialAmount === 'number' && !Number.isNaN(initialAmount) ? 'initial' : 'recurring',
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
  const result = await retryable((rop) => preapproval.create({
    body: {
      preapproval_plan_id: opts.planId,
      payer_email: opts.payerEmail,
      external_reference: opts.externalReference,
      back_url: opts.successUrl,
      status: 'pending',
      reason: opts.reason,
    },
    requestOptions: { timeout: rop.timeout },
  }));

  return {
    initPoint: result.init_point ?? '',
    preapprovalId: result.id ?? '',
  };
}

export async function searchPreapprovalsByRef(externalReference: string): Promise<{ id: string; status: string } | null> {
  if (!client) return null;

  try {
    const result = await retryable(async (opts) => {
      const url = `https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(externalReference)}&status=authorized&status=active`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.MERCADO_PAGO_ACCESS_TOKEN}` },
        signal: opts.signal,
      });
      if (!res.ok) throw new Error(`MP API error: ${res.status}`);
      return res.json() as Promise<{ results: Array<{ id: string; status: string }> }>;
    });

    const results = result?.results ?? [];
    // Priorizar preapprovals activos sobre authorized
    const active = results.find((p) => p.status === 'active') ?? results.find((p) => p.status === 'authorized') ?? null;
    if (!active) return null;

    return { id: active.id, status: active.status };
  } catch (err) {
    log.error({ err }, 'Error searching preapprovals by ref:');
    return null;
  }
}

export async function searchPreapprovalsByRefAll(externalReference: string): Promise<Array<{ id: string; status: string }>> {
  if (!client) return [];

  try {
    const result = await retryable(async (opts) => {
      const url = `https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(externalReference)}&limit=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.MERCADO_PAGO_ACCESS_TOKEN}` },
        signal: opts.signal,
      });
      if (!res.ok) throw new Error(`MP API error: ${res.status}`);
      return res.json() as Promise<{ results: Array<{ id: string; status: string }> }>;
    });

    return result?.results ?? [];
  } catch (err) {
    log.error({ err }, 'Error searching preapprovals by ref (todos los estados):');
    return [];
  }
}

export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  if (!client) {
    throw new Error('Mercado Pago no está configurado');
  }

  const preapproval = new PreApproval(client);
  await retryable((opts) => preapproval.update({ id: preapprovalId, body: { status: 'cancelled' }, requestOptions: { timeout: opts.timeout } }));
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPreApprovalCreate = vi.fn();
const mockPreferenceCreate = vi.fn();
const mockPaymentGet = vi.fn();
const mockPreApprovalGet = vi.fn();
const mockPreApprovalUpdate = vi.fn();

vi.mock('../config.js', () => ({
  config: {
    MERCADO_PAGO_ACCESS_TOKEN: 'test-token',
    BACKEND_URL: 'https://api.test.com',
    FRONTEND_URL: 'http://localhost:5173',
    PRO_MONTHLY_PRICE_CENTS: 59900,
    PRO_YEARLY_PRICE_CENTS: 660000,
    PRO_PLUS_MONTHLY_PRICE_CENTS: 99900,
    NODE_ENV: 'test',
  },
}));

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(),
  PreApproval: vi.fn(() => ({
    create: mockPreApprovalCreate,
    get: mockPreApprovalGet,
    update: mockPreApprovalUpdate,
  })),
  Preference: vi.fn(() => ({
    create: mockPreferenceCreate,
  })),
  Payment: vi.fn(() => ({
    get: mockPaymentGet,
  })),
}));

vi.mock('../db/index.js', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  events: {},
  cashContributions: {},
}));

import {
  serializeError,
  retryable,
  fetchPaymentInfo,
  cancelPreapproval,
} from '../services/mercadopago.js';

describe('serializeError', () => {
  it('returns Error instance as-is', () => {
    const err = new Error('original');
    const result = serializeError(err);
    expect(result).toBe(err);
  });

  it('converts object with message to Error', () => {
    const result = serializeError({ message: 'object error', status: 400 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('object error');
  });

  it('attaches status and cause from object', () => {
    const cause = new Error('root cause');
    const result = serializeError({ message: 'wrapped', status: 500, cause });
    expect((result as any).status).toBe(500);
    expect((result as any).cause).toBe(cause);
  });

  it('handles non-object values', () => {
    const result = serializeError('string error');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('string error');
  });

  it('handles null', () => {
    const result = serializeError(null);
    expect(result).toBeInstanceOf(Error);
  });
});

describe('retryable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryable(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on 4xx error', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400, message: 'Bad request' });
    await expect(retryable(fn)).rejects.toThrow('Bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 4xx with status < 500', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 429, message: 'Too many' });
    await expect(retryable(fn)).rejects.toThrow('Too many');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockRejectedValueOnce({ status: 502 })
      .mockResolvedValueOnce('recovered');

    const result = await retryable(fn, 3);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  }, 15000);

  it('throws after exhausting retries on 5xx', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 });
    await expect(retryable(fn, 2)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);

  it('handles non-status errors as 5xx', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network failure'));
    await expect(retryable(fn, 2)).rejects.toThrow('network failure');
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('fetchPaymentInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed payment info', async () => {
    mockPaymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: 'ref-1',
      transaction_amount: 50000,
      payer: { first_name: 'Juan', email: 'juan@test.com' },
      preapproval_id: 'pre-1',
    });

    const info = await fetchPaymentInfo('pay-1');
    expect(info.status).toBe('approved');
    expect(info.externalReference).toBe('ref-1');
    expect(info.transactionAmount).toBe(50000);
    expect(info.payerName).toBe('Juan');
    expect(info.payerEmail).toBe('juan@test.com');
    expect(info.preapprovalId).toBe('pre-1');
  });

  it('returns null preapprovalId when payment has none', async () => {
    mockPaymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: 'ref-2',
      transaction_amount: 50000,
    });

    const info = await fetchPaymentInfo('pay-2');
    expect(info.preapprovalId).toBeNull();
  });
});

describe('createPreApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a preapproval and returns init point and id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }));
    mockPreApprovalCreate.mockResolvedValueOnce({
      init_point: 'https://mercadopago.com.co/checkout/pre-1',
      id: 'pre-1',
    });

    const result = await import('../services/mercadopago.js').then(m => m.createPreApproval({
      planId: 'plan-1',
      payerEmail: 'test@test.com',
      externalReference: 'pro_user-1_month',
      successUrl: 'https://app.com/success',
      cancelUrl: 'https://app.com/cancel',
      reason: 'Fiesta y Lista Pro Mensual',
    }));

    expect(result.initPoint).toBe('https://mercadopago.com.co/checkout/pre-1');
    expect(result.preapprovalId).toBe('pre-1');
    expect(mockPreApprovalCreate).toHaveBeenCalledWith({
      body: {
        preapproval_plan_id: 'plan-1',
        payer_email: 'test@test.com',
        external_reference: 'pro_user-1_month',
        back_url: 'https://app.com/success',
        status: 'pending',
        reason: 'Fiesta y Lista Pro Mensual',
      },
      requestOptions: { timeout: expect.any(Number) },
    });
  });

  it('reutiliza un preapproval existente no cancelado (C4)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 'pre-existente', status: 'authorized' }] }),
    }));
    mockPreApprovalGet.mockResolvedValueOnce({
      id: 'pre-existente',
      init_point: 'https://mercadopago.com.co/checkout/pre-existente',
    });

    const result = await import('../services/mercadopago.js').then(m => m.createPreApproval({
      planId: 'plan-1',
      payerEmail: 'test@test.com',
      externalReference: 'pro_user-1_month',
      successUrl: 'https://app.com/success',
      cancelUrl: 'https://app.com/cancel',
      reason: 'Fiesta y Lista Pro Mensual',
    }));

    expect(result.preapprovalId).toBe('pre-existente');
    expect(mockPreApprovalCreate).not.toHaveBeenCalled();
  });

  it('crea uno nuevo cuando el existente está cancelado (C4)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 'pre-cancelado', status: 'cancelled' }] }),
    }));
    mockPreApprovalCreate.mockResolvedValueOnce({
      init_point: 'https://mercadopago.com.co/checkout/pre-nuevo',
      id: 'pre-nuevo',
    });

    const result = await import('../services/mercadopago.js').then(m => m.createPreApproval({
      planId: 'plan-1',
      payerEmail: 'test@test.com',
      externalReference: 'pro_user-1_month',
      successUrl: 'https://app.com/success',
      cancelUrl: 'https://app.com/cancel',
      reason: 'Fiesta y Lista Pro Mensual',
    }));

    expect(result.preapprovalId).toBe('pre-nuevo');
    expect(mockPreApprovalCreate).toHaveBeenCalledTimes(1);
  });

  it('D3-M6: tras un timeout parcial del create, el reintento reutiliza el preapproval ya creado (sin duplicar)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: 'pre-retry', status: 'pending' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);
    mockPreApprovalCreate.mockRejectedValueOnce(new Error('timeout'));
    mockPreApprovalGet.mockResolvedValueOnce({
      id: 'pre-retry',
      init_point: 'https://mercadopago.com.co/checkout/pre-retry',
    });

    const result = await import('../services/mercadopago.js').then(m => m.createPreApproval({
      planId: 'plan-1',
      payerEmail: 'test@test.com',
      externalReference: 'pro_user-1_month',
      successUrl: 'https://app.com/success',
      cancelUrl: 'https://app.com/cancel',
      reason: 'Fiesta y Lista Pro Mensual',
    }));

    expect(result.preapprovalId).toBe('pre-retry');
    expect(mockPreApprovalCreate).toHaveBeenCalledTimes(1);
  });
});

describe('fetchPreapprovalInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed preapproval info', async () => {
    mockPreApprovalGet.mockResolvedValueOnce({
      status: 'active',
      external_reference: 'pro_user-1_month',
      payer_email: 'test@test.com',
      reason: 'Pro Mensual',
      auto_recurring: { transaction_amount: 59900 },
      next_charge_date: '2026-08-01T00:00:00Z',
      date_created: '2026-07-01T00:00:00Z',
    });

    const { fetchPreapprovalInfo } = await import('../services/mercadopago.js');
    const info = await fetchPreapprovalInfo('pre-1');

    expect(info.status).toBe('active');
    expect(info.externalReference).toBe('pro_user-1_month');
    expect(info.payerEmail).toBe('test@test.com');
    expect(info.transactionAmount).toBe(59900);
    expect(info.nextChargeDate).toBe('2026-08-01T00:00:00Z');
    expect(info.dateCreated).toBe('2026-07-01T00:00:00Z');
  });
});

describe('cancelPreapproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates preapproval to cancelled', async () => {
    mockPreApprovalUpdate.mockResolvedValueOnce({});

    await cancelPreapproval('pre-1');
    expect(mockPreApprovalUpdate).toHaveBeenCalledWith({
      id: 'pre-1',
      body: { status: 'cancelled' },
      requestOptions: { timeout: expect.any(Number) },
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    PRO_MONTHLY_PRICE_CENTS: 24990,
    PRO_YEARLY_PRICE_CENTS: 288000,
    BOOST_PRICE_CENTS: 10000,
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
  boostPayments: {},
  cashContributions: {},
}));

import {
  serializeError,
  retryable,
  createProPreference,
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

describe('createProPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates preference and returns URL', async () => {
    mockPreferenceCreate.mockResolvedValueOnce({ init_point: 'https://mp.com/pay/123' });

    const result = await createProPreference(
      'user-1', 'month',
      'http://localhost:5173/success', 'http://localhost:5173/cancel',
    );

    expect(result).toEqual({ url: 'https://mp.com/pay/123' });
    expect(mockPreferenceCreate).toHaveBeenCalledTimes(1);
    const body = mockPreferenceCreate.mock.calls[0][0].body;
    expect(body.external_reference).toBe('pro_user-1_month');
    expect(body.items[0].unit_price).toBe(24990);
  });

  it('uses yearly price for year interval', async () => {
    mockPreferenceCreate.mockResolvedValueOnce({ init_point: 'https://mp.com/pay/456' });

    const result = await createProPreference(
      'user-1', 'year',
      'http://localhost:5173/success', 'http://localhost:5173/cancel',
    );

    expect(result).toEqual({ url: 'https://mp.com/pay/456' });
    const body = mockPreferenceCreate.mock.calls[0][0].body;
    expect(body.external_reference).toBe('pro_user-1_year');
    expect(body.items[0].unit_price).toBe(288000);
  });

  it('throws if no init_point returned', async () => {
    mockPreferenceCreate.mockResolvedValueOnce({});

    await expect(createProPreference(
      'user-1', 'month',
      'http://localhost:5173/success', 'http://localhost:5173/cancel',
    )).rejects.toThrow('No se pudo generar la URL de pago');
  });
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
      payer: { first_name: 'Juan' },
    });

    const info = await fetchPaymentInfo('pay-1');
    expect(info.status).toBe('approved');
    expect(info.externalReference).toBe('ref-1');
    expect(info.transactionAmount).toBe(50000);
    expect(info.payerName).toBe('Juan');
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
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test',
    FROM_EMAIL: 'test@test.com',
    FRONTEND_URL: 'http://localhost:5173',
    PRO_MONTHLY_PRICE_CENTS: 8900,
    PRO_YEARLY_PRICE_CENTS: 89000,
    PRO_PLUS_MONTHLY_PRICE_CENTS: 14900,
    PRO_PLUS_YEARLY_PRICE_CENTS: 149000,
  },
}));

const mockSubsService = vi.hoisted(() => ({
  createOrUpdateSubscription: vi.fn().mockResolvedValue({ id: 'sub-1' }),
  getCurrentSubscription: vi.fn().mockResolvedValue(null),
  cancelSubscription: vi.fn().mockResolvedValue({ status: 'canceled' }),
  updateSubscriptionStatus: vi.fn().mockResolvedValue({ status: 'past_due' }),
}));

vi.mock('../db/index.js', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  users: {},
  subscriptions: {},
  proPayments: {},
  emailTracking: {},
}));

vi.mock('../services/subscription.js', () => mockSubsService);

const mockMp = vi.hoisted(() => ({
  fetchPaymentInfo: vi.fn(),
  fetchPreapprovalInfo: vi.fn(),
  searchPreapprovalsByRef: vi.fn(),
  cancelPreapproval: vi.fn().mockResolvedValue(undefined),
  retryable: vi.fn(async (fn: (opts: { signal?: AbortSignal; timeout?: number }) => Promise<unknown>) => fn({})),
}));

vi.mock('../services/mercadopago.js', () => mockMp);

vi.mock('../services/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendProConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendPastDueEmail: vi.fn().mockResolvedValue(undefined),
  escapeHtml: (v: string) => v,
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
}));

import { handleProPayment, handlePaymentNotification, handleSubscriptionNotification } from '../services/mp-webhooks.js';

beforeEach(() => {
  vi.clearAllMocks();
});

function makePaymentTx(currentSub: { mpSubscriptionId: string | null; tier: string | null }) {
  const tx: any = {
    execute: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn() })) })),
    })),
  };
  // dos selects secuenciales: existingPayment y currentSub
  tx.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) });
  tx.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([currentSub]) })) })) });
  return tx;
}

describe('handleProPayment', () => {
  beforeEach(() => {
    vi.mocked(mockSubsService.createOrUpdateSubscription).mockResolvedValue({ id: 'sub-1' });
    vi.mocked(mockMp.cancelPreapproval).mockResolvedValue(undefined);
  });

  it('C1: guarda el preapproval NUEVO y cancela el viejo en downgrade (sin doble cobro)', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-OLD', tier: 'pro_plus' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleProPayment('pay-1', 'user-1', 'month', 'pro', 'PA-NEW');

    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-NEW', tier: 'pro', status: 'active' }),
      expect.anything(),
    );
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-OLD');
  });

  it('C1: no cancela el preapproval cuando es el mismo (renovación normal)', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-SAME', tier: 'pro' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleProPayment('pay-2', 'user-1', 'month', 'pro', 'PA-SAME');

    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-SAME' }),
      expect.anything(),
    );
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
  });

  it('C1: busca el preapproval por external_reference si el pago no lo trae', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-OLD', tier: 'pro' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
    mockMp.searchPreapprovalsByRef.mockResolvedValue({ id: 'PA-FOUND', status: 'active' });

    await handleProPayment('pay-3', 'user-1', 'month', 'pro');

    expect(mockMp.searchPreapprovalsByRef).toHaveBeenCalledWith('pro_user-1_month');
    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-FOUND' }),
      expect.anything(),
    );
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-OLD');
  });

  it('C1: no cancela nada si no hay preapproval anterior', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: null, tier: 'free' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleProPayment('pay-4', 'user-1', 'month', 'pro', 'PA-NEW');

    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-NEW' }),
      expect.anything(),
    );
  });
});

describe('handleSubscriptionNotification', () => {
  const basePreapproval = {
    status: 'active' as string,
    externalReference: 'pro_user-1_month',
    payerEmail: 'user@test.com',
    reason: 'Fiesta y Lista Pro',
    transactionAmount: 8900,
    nextChargeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    dateCreated: new Date().toISOString(),
  };

  it('C2: ignora webhook cancelled de un preapproval reemplazado', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ ...basePreapproval, status: 'cancelled' });
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-NEW', status: 'active' });

    await handleSubscriptionNotification('PA-OLD');

    expect(mockSubsService.cancelSubscription).not.toHaveBeenCalled();
  });

  it('C2: cancela cuando el webhook cancelled es del preapproval ACTUAL', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ ...basePreapproval, status: 'cancelled' });
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-CUR', status: 'active' });

    await handleSubscriptionNotification('PA-CUR');

    expect(mockSubsService.cancelSubscription).toHaveBeenCalledWith('user-1');
  });

  it('C1: ignora webhook active de un preapproval reemplazado', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue(basePreapproval);
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-NEW', tier: 'pro', status: 'active' });

    await handleSubscriptionNotification('PA-OLD');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });

  it('A3: ignora webhook active de un tier menor al activo', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue(basePreapproval);
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-CUR', tier: 'pro_plus', status: 'active' });

    await handleSubscriptionNotification('PA-CUR');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });

  it('ignora webhook active duplicado del mismo preapproval', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue(basePreapproval);
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-CUR', tier: 'pro', status: 'active' });

    await handleSubscriptionNotification('PA-CUR');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });

  it('A1: authorized registra pending_approval (no otorga tier — lo maneja createOrUpdateSubscription)', async () => {
    const { db } = await import('../db/index.js');
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ ...basePreapproval, status: 'authorized' });
    mockSubsService.getCurrentSubscription.mockResolvedValue(null);
    const tx: any = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleSubscriptionNotification('PA-NEW');

    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-NEW', tier: 'pro', status: 'pending_approval' }),
      expect.anything(),
    );
  });

  it('C2: ignora webhook past_due de un preapproval reemplazado', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ ...basePreapproval, status: 'past_due' });
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-NEW', status: 'active' });

    await handleSubscriptionNotification('PA-OLD');

    expect(mockSubsService.updateSubscriptionStatus).not.toHaveBeenCalled();
  });
});

describe('handlePaymentNotification (refund/chargeback)', () => {
  const refundedPayment = {
    status: 'refunded' as string,
    externalReference: 'pro_user-1_month',
    transactionAmount: 8900,
    payerName: 'Juan',
    payerEmail: 'user@test.com',
    preapprovalId: 'PA-OLD',
  };

  async function mockCurrentSubSelect(mpSubscriptionId: string | null) {
    const { db } = await import('../db/index.js');
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ mpSubscriptionId }]) })) })),
    });
    (db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      set: vi.fn(() => ({ where: vi.fn(() => ({ catch: vi.fn().mockResolvedValue(undefined) })) })),
    });
    return db;
  }

  it('REG: pago approved de plan PRO (ref pro_ sin plus) sí procesa', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: null, tier: 'free' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
    mockMp.fetchPaymentInfo.mockResolvedValue({
      status: 'approved',
      externalReference: 'pro_user-1_month',
      transactionAmount: 8900,
      preapprovalId: 'PA-PRO',
    });

    await handlePaymentNotification('pay-pro');

    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-PRO', tier: 'pro', status: 'active' }),
      expect.anything(),
    );
  });

  it('A4: refund de un pago ANTIGUO no cancela la suscripción actual', async () => {
    mockMp.fetchPaymentInfo.mockResolvedValue(refundedPayment);
    const db = await mockCurrentSubSelect('PA-NEW');

    await handlePaymentNotification('pay-old');

    expect(mockSubsService.cancelSubscription).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it('A4: refund del preapproval ACTUAL sí cancela la suscripción', async () => {
    mockMp.fetchPaymentInfo.mockResolvedValue({ ...refundedPayment, preapprovalId: 'PA-CUR' });
    await mockCurrentSubSelect('PA-CUR');

    await handlePaymentNotification('pay-cur');

    expect(mockSubsService.cancelSubscription).toHaveBeenCalledWith('user-1', true);
  });

  it('A4: refund sin suscripción registrada cancela', async () => {
    mockMp.fetchPaymentInfo.mockResolvedValue(refundedPayment);
    await mockCurrentSubSelect(null);

    await handlePaymentNotification('pay-nosub');

    expect(mockSubsService.cancelSubscription).toHaveBeenCalledWith('user-1', true);
  });
});

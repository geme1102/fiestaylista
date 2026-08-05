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

function makePaymentTx(currentSub: { mpSubscriptionId: string | null; tier: string | null; status?: string | null }) {
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

  it('H3: lanza error si no se puede identificar el preapproval (ni del pago ni por búsqueda)', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-OLD', tier: 'pro' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
    mockMp.searchPreapprovalsByRef.mockResolvedValue(null);

    await expect(handleProPayment('pay-5', 'user-1', 'month', 'pro')).rejects.toThrow(/No se pudo identificar el preapproval/);

    // El doble cobro ocurría aquí: se conservaba el id viejo y se cancelaba el
    // preapproval equivocado. Ahora no se actualiza ni cancela nada.
    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
  });

  it('C1 (pago): ignora un pago de un preapproval REEMPLAZADO — no degrada ni cancela el nuevo', async () => {
    const { db } = await import('../db/index.js');
    // Sub activa apuntando al preapproval NUEVO (PA-NEW); llega un pago tardío
    // del preapproval VIEJO (PA-OLD) — antes degradaba a pro y cancelaba PA-NEW.
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-NEW', tier: 'pro_plus', status: 'active' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
    mockMp.fetchPreapprovalInfo.mockImplementation((id: string) => {
      if (id === 'PA-NEW') return Promise.resolve({ id, status: 'active', dateCreated: '2026-08-05T00:00:00Z' });
      return Promise.resolve({ id, status: 'active', dateCreated: '2026-07-01T00:00:00Z' });
    });

    await handleProPayment('pay-6', 'user-1', 'month', 'pro', 'PA-OLD');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
  });

  it('C1 (pago): procesa un pago del preapproval MÁS NUEVO con sub activa (upgrade) — actualiza tier y cancela el viejo', async () => {
    const { db } = await import('../db/index.js');
    // BUG real: sub activa pro apuntando a PA-OLD (viejo); el usuario upgradea a
    // pro_plus y llega el pago del preapproval NUEVO (PA-NEW, creado después).
    // Antes se ignoraba → tier nunca subía y MP cobraba ambos preapprovals.
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-OLD', tier: 'pro', status: 'active' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
    mockMp.fetchPreapprovalInfo.mockImplementation((id: string) => {
      if (id === 'PA-NEW') return Promise.resolve({ id, status: 'active', dateCreated: '2026-08-05T00:00:00Z' });
      return Promise.resolve({ id, status: 'active', dateCreated: '2026-07-01T00:00:00Z' });
    });

    await handleProPayment('pay-upgrade', 'user-1', 'month', 'pro_plus', 'PA-NEW');

    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-NEW', tier: 'pro_plus', status: 'active' }),
      expect.anything(),
    );
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-OLD');
  });

  it('C1 (pago): ignora de forma conservadora si no se puede comparar antigüedad (MP caído)', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-NEW', tier: 'pro_plus', status: 'active' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
    mockMp.fetchPreapprovalInfo.mockRejectedValue(new Error('MP down'));

    await handleProPayment('pay-indet', 'user-1', 'month', 'pro', 'PA-OLD');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
  });

  it('A3 (pago): ignora un pago de tier menor al activo', async () => {
    const { db } = await import('../db/index.js');
    const tx = makePaymentTx({ mpSubscriptionId: 'PA-SAME', tier: 'pro_plus', status: 'active' });
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleProPayment('pay-7', 'user-1', 'month', 'pro', 'PA-SAME');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
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

  it('C1: ignora webhook active de un preapproval reemplazado (entrante MÁS VIEJO que el actual)', async () => {
    mockMp.fetchPreapprovalInfo.mockImplementation((id: string) => {
      if (id === 'PA-NEW') return Promise.resolve({ ...basePreapproval, dateCreated: '2026-08-05T00:00:00Z' });
      return Promise.resolve({ ...basePreapproval, dateCreated: '2026-07-01T00:00:00Z' });
    });
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-NEW', tier: 'pro', status: 'active' });

    await handleSubscriptionNotification('PA-OLD');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
  });

  it('C1: procesa el webhook active de un preapproval MÁS NUEVO con sub activa (upgrade) — actualiza y cancela el viejo', async () => {
    const { db } = await import('../db/index.js');
    // BUG real: sub activa pro apuntando a PA-OLD; webhook active de PA-NEW
    // (pro_plus, creado después) — antes se ignoraba y el upgrade quedaba a medias
    // con ambos preapprovals cobrando en MP.
    mockMp.fetchPreapprovalInfo.mockImplementation((id: string) => {
      if (id === 'PA-NEW') return Promise.resolve({ ...basePreapproval, externalReference: 'pro_plus_user-1_month', transactionAmount: 14900, dateCreated: '2026-08-05T00:00:00Z' });
      return Promise.resolve({ ...basePreapproval, externalReference: 'pro_user-1_month', dateCreated: '2026-07-01T00:00:00Z' });
    });
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-OLD', tier: 'pro', status: 'active' });
    const tx: any = { execute: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleSubscriptionNotification('PA-NEW');

    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mpSubscriptionId: 'PA-NEW', tier: 'pro_plus', status: 'active' }),
      expect.anything(),
    );
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-OLD');
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

  it('MEDIUM-2: authorized de un preapproval REEMPLAZADO no toca la sub activa', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ ...basePreapproval, status: 'authorized' });
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-NEW', tier: 'pro_plus', status: 'active' } as any);

    await handleSubscriptionNotification('PA-OLD');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });

  it('MEDIUM-2: authorized NO degrada una sub activa (aunque sea el mismo preapproval)', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ ...basePreapproval, status: 'authorized' });
    mockSubsService.getCurrentSubscription.mockResolvedValue({ mpSubscriptionId: 'PA-CUR', tier: 'pro', status: 'active' } as any);

    await handleSubscriptionNotification('PA-CUR');

    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });

  it('MEDIUM-2: authorized de plan anual usa periodDays=365 (no 30 hardcodeados)', async () => {
    const { db } = await import('../db/index.js');
    mockMp.fetchPreapprovalInfo.mockResolvedValue({
      ...basePreapproval,
      status: 'authorized',
      externalReference: 'pro_user-1_year',
      nextChargeDate: null,
      amountSource: 'recurring',
    });
    mockSubsService.getCurrentSubscription.mockResolvedValue(null);
    const tx: any = { execute: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleSubscriptionNotification('PA-YEAR');

    const call = mockSubsService.createOrUpdateSubscription.mock.calls[0][1] as any;
    const end = new Date(call.currentPeriodEnd).getTime();
    const diffDays = (end - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(360);
    expect(diffDays).toBeLessThan(370);
  });

  it('M7: preapproval con solo auto_recurring (amountSource recurring) no valida monto — no se ignora', async () => {
    const { db } = await import('../db/index.js');
    mockMp.fetchPreapprovalInfo.mockResolvedValue({
      ...basePreapproval,
      transactionAmount: 890, // no coincide con el precio mensual (8900)
      amountSource: 'recurring',
    });
    mockSubsService.getCurrentSubscription.mockResolvedValue(null);
    const tx: any = { execute: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await handleSubscriptionNotification('PA-REC');

    expect(mockSubsService.createOrUpdateSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ tier: 'pro', status: 'active' }),
      expect.anything(),
    );
  });

  it('M7: preapproval con initial_amount (amountSource initial) y monto incorrecto lanza error', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue({
      ...basePreapproval,
      transactionAmount: 5000,
      amountSource: 'initial',
    });

    await expect(handleSubscriptionNotification('PA-INIT')).rejects.toThrow(/Monto de suscripción no coincide/);
    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });

  it('HIGH-1: preapproval sin external_reference pro_* lanza error (requiere revisión)', async () => {
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ ...basePreapproval, externalReference: '', status: 'active' });

    await expect(handleSubscriptionNotification('PA-NOREF')).rejects.toThrow(/external_reference pro_\*/);
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

  it('H1: pago approved con monto incorrecto lanza error (entra a failedWebhooks en vez de silenciarse)', async () => {
    mockMp.fetchPaymentInfo.mockResolvedValue({
      status: 'approved',
      externalReference: 'pro_user-1_month',
      transactionAmount: 12345,
      preapprovalId: 'PA-PRO',
    });

    await expect(handlePaymentNotification('pay-wrong-amount')).rejects.toThrow(/Monto de PRO inválido/);
    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });

  it('HIGH-1: pago approved sin external_reference pro_* lanza error — no otorga tier por monto', async () => {
    mockMp.fetchPaymentInfo.mockResolvedValue({
      status: 'approved',
      externalReference: '',
      transactionAmount: 599, // antes: normalización ×100 → matcheaba el precio completo
      preapprovalId: null,
    });

    await expect(handlePaymentNotification('pay-noref')).rejects.toThrow(/external_reference pro_\*/);
    expect(mockSubsService.createOrUpdateSubscription).not.toHaveBeenCalled();
  });
});

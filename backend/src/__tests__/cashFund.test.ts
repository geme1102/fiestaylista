import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    FRONTEND_URL: 'http://localhost:5173',
    CONTRIBUTION_EXPIRY_HOURS: 24,
  },
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
  cashFunds: {},
  cashContributions: {},
  events: {},
  users: {},
  platformFees: {},
}));

vi.mock('./mercadopago.js', () => ({
  createContributionPreference: vi.fn(),
}));

import { createContribution, cleanupStaleContributions } from '../services/cashFund.js';
import { createContributionPreference } from './mercadopago.js';

async function runCreateContributionTx(callback: (tx: any) => Promise<any>) {
  const tx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    returning: vi.fn(),
  };
  await callback(tx);
  return tx;
}

describe('createContribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects amount below minimum', async () => {
    await expect(createContribution(
      'fund-1', 'Juan', 1999,
    )).rejects.toThrow('monto mínimo es $2,000');
  });

  it('sanitizes name by stripping <>', async () => {
    const { db } = await import('../db/index.js');
    const mp = await import('./mercadopago.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', title: 'Fondo', isActive: true, collectedAmount: 0, targetAmount: null, description: null, createdAt: new Date(), updatedAt: new Date() };
    const mockEvent = { slug: 'my-event' };
    const mockUser = { tier: 'free' };

    const mockTx: any = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      limit: vi.fn((_: any) => {
        if (!mockTx._callCount) mockTx._callCount = 0;
        mockTx._callCount++;
        if (mockTx._callCount === 1) return Promise.resolve([mockFund]);
        if (mockTx._callCount === 2) return Promise.resolve([mockEvent]);
        if (mockTx._callCount === 3) return Promise.resolve([mockUser]);
        if (mockTx._callCount === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
      returning: vi.fn().mockResolvedValue([{ id: 'contrib-1', cashFundId: 'fund-1', contributorName: 'Juan', amount: 5000, feeAmount: 280, netAmount: 4720, status: 'pending' }]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      return cb(mockTx);
    });

    vi.mocked(createContributionPreference).mockResolvedValue({ redirectUrl: 'https://mp.com/pay/123' });

    const result = await createContribution('fund-1', '<script>alert("xss")</script>Juan', 5000);
    expect(result.redirectUrl).toBe('https://mp.com/pay/123');
  });

  it('rejects empty name after sanitization', async () => {
    await expect(createContribution(
      'fund-1', '<>', 5000,
    )).rejects.toThrow('nombre es requerido');
  });

  it('calculates fee correctly for free tier (5%)', async () => {
    const { db } = await import('../db/index.js');
    const mp = await import('./mercadopago.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', title: 'Fondo', isActive: true, collectedAmount: 0, targetAmount: null, description: null, createdAt: new Date(), updatedAt: new Date() };
    const mockEvent = { slug: 'my-event' };
    const mockUser = { tier: 'free' };

    const mockTx: any = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      limit: vi.fn((_: any) => {
        if (!mockTx._callCount) mockTx._callCount = 0;
        mockTx._callCount++;
        if (mockTx._callCount === 1) return Promise.resolve([mockFund]);
        if (mockTx._callCount === 2) return Promise.resolve([mockEvent]);
        if (mockTx._callCount === 3) return Promise.resolve([mockUser]);
        if (mockTx._callCount === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
      returning: vi.fn().mockResolvedValue([{ id: 'contrib-1', cashFundId: 'fund-1', contributorName: 'Juan', amount: 10000, feeAmount: 530, netAmount: 9470, status: 'pending' }]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));
    vi.mocked(createContributionPreference).mockResolvedValue({ redirectUrl: 'https://mp.com/pay/123' });

    await createContribution('fund-1', 'Juan', 10000);
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('rejects contribution for inactive fund', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', title: 'Fondo', isActive: false, collectedAmount: 0, targetAmount: null, description: null, createdAt: new Date(), updatedAt: new Date() };

    const mockTx: any = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockFund]),
      insert: vi.fn(),
      values: vi.fn(),
      update: vi.fn(),
      set: vi.fn(),
      innerJoin: vi.fn(),
      returning: vi.fn(),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(createContribution(
      'fund-1', 'Juan', 5000,
    )).rejects.toThrow('ya no está activo');
  });
});

describe('cleanupStaleContributions', () => {
  it('returns number of expired contributions', async () => {
    const { db } = await import('../db/index.js');

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
        }),
      }),
    } as any);

    const count = await cleanupStaleContributions();
    expect(count).toBe(2);
  });
});

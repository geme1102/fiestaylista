import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    FRONTEND_URL: 'http://localhost:5173',
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
}));

import { createPromise, getPromisedAmount } from '../services/cashFund.js';

function createMockTx() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    limit: vi.fn(),
    returning: vi.fn(),
  };
}

describe('createPromise', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects amount below minimum', async () => {
    await expect(createPromise('fund-1', 'Juan', 1999)).rejects.toThrow('monto mínimo es $2,000');
  });

  it('rejects empty name after sanitization', async () => {
    await expect(createPromise('fund-1', '<>', 5000)).rejects.toThrow('nombre es requerido');
  });

  it('inserts promise and increments collectedAmount', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: true, collectedAmount: 0 };
    const mockEvent = { id: 'event-1' };
    const mockContribution = { id: 'c-1', cashFundId: 'fund-1', contributorName: 'Juan', amount: 50000, status: 'promised' };
    const mockUpdatedFund = { ...mockFund, collectedAmount: 50000 };

    const tx = createMockTx();
    let limitCount = 0;
    tx.limit.mockImplementation(() => {
      limitCount++;
      if (limitCount === 1) return Promise.resolve([mockFund]);
      if (limitCount === 2) return Promise.resolve([mockEvent]);
      if (limitCount === 3) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    let returningCount = 0;
    tx.returning.mockImplementation(() => {
      returningCount++;
      if (returningCount === 1) return Promise.resolve([mockContribution]);
      return Promise.resolve([mockUpdatedFund]);
    });
    tx.execute.mockResolvedValue(undefined);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await createPromise('fund-1', 'Juan', 50000);

    expect(result.contribution.id).toBe('c-1');
    expect(result.cashFund.collectedAmount).toBe(50000);
    expect(tx.update).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
  });

  it('reuses existing promise (idempotencia)', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: true };
    const mockEvent = { id: 'event-1' };
    const existing = { id: 'existing-1' };

    const tx = createMockTx();
    let limitCount = 0;
    tx.limit.mockImplementation(() => {
      limitCount++;
      if (limitCount === 1) return Promise.resolve([mockFund]);
      if (limitCount === 2) return Promise.resolve([mockEvent]);
      if (limitCount === 3) return Promise.resolve([existing]);
      return Promise.resolve([]);
    });
    tx.returning.mockResolvedValue([{ id: 'existing-1', message: 'nuevo', status: 'promised' }]);
    tx.execute.mockResolvedValue(undefined);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await createPromise('fund-1', 'Juan', 50000, 'nuevo');

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it('rejects inactive fund', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: false };

    const tx = createMockTx();
    tx.limit.mockResolvedValue([mockFund]);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await expect(createPromise('fund-1', 'Juan', 5000)).rejects.toThrow('ya no está activo');
  });
});

describe('getPromisedAmount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 when no promises', async () => {
    const { db } = await import('../db/index.js');
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ total: 0 }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);
    const total = await getPromisedAmount('fund-1');
    expect(total).toBe(0);
  });
});

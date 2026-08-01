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
  const tx: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    limit: vi.fn(),
    returning: vi.fn(),
  };
  tx.limit.mockReturnValue(Promise.resolve([]));
  tx.returning.mockReturnValue(Promise.resolve([]));
  return tx;
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

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: true, collectedAmount: 50000 };
    const mockEvent = { id: 'event-1' };
    const existing = { id: 'existing-1', status: 'promised', amount: 50000 };

    const tx = createMockTx();
    let limitCount = 0;
    tx.limit.mockImplementation(() => {
      limitCount++;
      if (limitCount === 1) return Promise.resolve([mockFund]);
      if (limitCount === 2) return Promise.resolve([mockEvent]);
      if (limitCount === 3) return Promise.resolve([existing]);
      return Promise.resolve([mockFund]);
    });
    tx.returning.mockResolvedValue([{ id: 'existing-1', message: 'nuevo', status: 'promised' }]);
    tx.execute.mockResolvedValue(undefined);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await createPromise('fund-1', 'Juan', 50000, 'nuevo');

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(result.cashFund.collectedAmount).toBe(50000);
  });

  it('reactivates a cancelled promise with new amount', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: true, collectedAmount: 0 };
    const mockEvent = { id: 'event-1' };
    const existing = { id: 'existing-1', status: 'cancelled', amount: 50000 };
    const mockUpdatedFund = { ...mockFund, collectedAmount: 80000 };

    const tx = createMockTx();
    let limitCount = 0;
    tx.limit.mockImplementation(() => {
      limitCount++;
      if (limitCount === 1) return Promise.resolve([mockFund]);
      if (limitCount === 2) return Promise.resolve([mockEvent]);
      if (limitCount === 3) return Promise.resolve([existing]);
      return Promise.resolve([]);
    });
    let returningCount = 0;
    tx.returning.mockImplementation(() => {
      returningCount++;
      if (returningCount === 1) return Promise.resolve([{ id: 'existing-1', status: 'promised', amount: 80000 }]);
      return Promise.resolve([mockUpdatedFund]);
    });
    tx.execute.mockResolvedValue(undefined);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await createPromise('fund-1', 'Juan', 80000);

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(result.cashFund.collectedAmount).toBe(80000);
  });

  it('rejects inactive fund', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: false };

    const tx = createMockTx();
    tx.limit.mockResolvedValue([mockFund]);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await expect(createPromise('fund-1', 'Juan', 5000)).rejects.toThrow('ya no está activo');
  });

  it('colapses case variants of the same name (anti-spam)', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: true, collectedAmount: 50000 };
    const mockEvent = { id: 'event-1' };
    const existing = { id: 'existing-1', status: 'promised', amount: 50000 };

    const tx = createMockTx();
    let limitCount = 0;
    tx.limit.mockImplementation(() => {
      limitCount++;
      if (limitCount === 1) return Promise.resolve([mockFund]);
      if (limitCount === 2) return Promise.resolve([mockEvent]);
      if (limitCount === 3) return Promise.resolve([existing]);
      return Promise.resolve([mockFund]);
    });
    tx.returning.mockResolvedValue([{ id: 'existing-1', status: 'promised', amount: 50000 }]);
    tx.execute.mockResolvedValue(undefined);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await createPromise('fund-1', 'aNa', 50000);

    expect(tx.insert).not.toHaveBeenCalled();
    expect(result.contribution.status).toBe('promised');
  });
});

describe('getContributions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('excludes cancelled contributions for guests', async () => {
    const { db } = await import('../db/index.js');
    const { getContributions } = await import('../services/cashFund.js');
    const rows = [{ id: 'c-1', status: 'promised' }];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    vi.mocked(db.select).mockReturnValue(chain as any);
    const res = await getContributions('fund-1', {}, true);
    expect(res.data).toHaveLength(1);
    expect(chain.limit).toHaveBeenCalledWith(51);
  });

  it('includes cancelled contributions for the owner', async () => {
    const { db } = await import('../db/index.js');
    const { getContributions } = await import('../services/cashFund.js');
    const rows = [{ id: 'c-1', status: 'cancelled' }];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    vi.mocked(db.select).mockReturnValue(chain as any);
    const res = await getContributions('fund-1', {}, false);
    expect(res.data).toHaveLength(1);
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

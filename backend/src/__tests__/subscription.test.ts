import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
  },
}));

function mockReturning(rows: any[]) {
  return { returning: vi.fn().mockResolvedValue(rows) };
}

function mockInsertChain(returningVal: { returning: any }) {
  const onConflictDoUpdate = vi.fn().mockReturnValue(returningVal);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, onConflictDoUpdate, returning: returningVal.returning };
}

function mockUpdateChain() {
  const where2 = vi.fn().mockResolvedValue(undefined);
  const set2 = vi.fn().mockReturnValue({ where: where2 });
  const update2 = vi.fn().mockReturnValue({ set: set2 });
  return { update: update2, set: set2, where: where2 };
}

function mockSelectChain(limitResult: any[]) {
  const limitSelect = vi.fn().mockResolvedValue(limitResult);
  const orderBy = vi.fn().mockReturnValue({ limit: limitSelect });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where, orderBy, limit: limitSelect };
}

vi.mock('../db/index.js', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  subscriptions: {},
  users: {},
  events: {},
}));

import {
  cancelSubscription,
  getCurrentSubscription,
  expireStaleSubscriptions,
  createOrUpdateSubscription,
} from '../services/subscription.js';

const mockSub = {
  id: 'sub-1',
  userId: 'user-1',
  mpSubscriptionId: 'mp-1',
  tier: 'pro',
  status: 'active',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getCurrentSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns subscription when found', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockSub]),
        }),
      }),
    } as any);

    const result = await getCurrentSubscription('user-1');
    expect(result).toEqual(mockSub);
  });

  it('returns null when no subscription', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const result = await getCurrentSubscription('user-1');
    expect(result).toBeNull();
  });
});

describe('cancelSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels subscription without downgrading tier when not immediate', async () => {
    const { db } = await import('../db/index.js');

    const mockTx: any = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockSub]),
      select: vi.fn(),
      from: vi.fn(),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    const result = await cancelSubscription('user-1', false);
    expect(result.status).toBe('active');
  });
});

describe('expireStaleSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when no stale subscriptions', async () => {
    const { db } = await import('../db/index.js');

    const mockTx: any = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    const count = await expireStaleSubscriptions();
    expect(count).toBe(0);
  });
});

describe('createOrUpdateSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unfreezes up to maxEvents (1) events for pro tier', async () => {
    const { db } = await import('../db/index.js');

    const returningVal = mockReturning([{ id: 'sub-1' }]);
    const ins = mockInsertChain(returningVal);
    const upd = mockUpdateChain();
    const sel = mockSelectChain([{ id: 'evt-1' }]);

    vi.mocked(db.insert).mockImplementation(ins.insert);
    vi.mocked(db.update).mockImplementation(upd.update);
    vi.mocked(db.select).mockImplementation(sel.select);

    await createOrUpdateSubscription('user-1', {
      mpSubscriptionId: null,
      tier: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    });

    expect(sel.limit).toHaveBeenCalledWith(1);
    expect(ins.returning).toHaveBeenCalled();
  });

  it('unfreezes up to maxEvents (3) events for pro_plus tier', async () => {
    const { db } = await import('../db/index.js');

    const returningVal = mockReturning([{ id: 'sub-1' }]);
    const ins = mockInsertChain(returningVal);
    const upd = mockUpdateChain();
    const sel = mockSelectChain(Array.from({ length: 3 }, (_, i) => ({ id: `evt-${i + 1}` })));

    vi.mocked(db.insert).mockImplementation(ins.insert);
    vi.mocked(db.update).mockImplementation(upd.update);
    vi.mocked(db.select).mockImplementation(sel.select);

    await createOrUpdateSubscription('user-1', {
      mpSubscriptionId: null,
      tier: 'pro_plus',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    });

    expect(sel.limit).toHaveBeenCalledWith(3);
  });

  it('does not unfreeze events when status is not active', async () => {
    const { db } = await import('../db/index.js');

    const returningVal = mockReturning([{ id: 'sub-1' }]);
    const ins = mockInsertChain(returningVal);
    const upd = mockUpdateChain();

    vi.mocked(db.insert).mockImplementation(ins.insert);
    vi.mocked(db.update).mockImplementation(upd.update);
    vi.mocked(db.select).mockReturnValue({} as any);

    await createOrUpdateSubscription('user-1', {
      mpSubscriptionId: null,
      tier: 'pro',
      status: 'canceled',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    });

    expect(db.select).not.toHaveBeenCalled();
  });
});

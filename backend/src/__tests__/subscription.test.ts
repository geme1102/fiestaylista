import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
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
  subscriptions: {},
  users: {},
  events: {},
}));

import {
  cancelSubscription,
  getCurrentSubscription,
  expireStaleSubscriptions,
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

const mockUser = { id: 'user-1', tier: 'pro' };

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

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
  // `then` hace que `where` sea awaitable directamente (queries que terminan
  // en .where(), como el count de D9) Y que soporte .orderBy().limit()
  const where = vi.fn().mockReturnValue({ orderBy, then: (resolve: any) => resolve(limitResult) });
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
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }]),
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
      execute: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    const count = await expireStaleSubscriptions();
    expect(count).toBe(0);
  });

  it('A1: la consulta de expiración incluye pending_approval', async () => {
    const { db } = await import('../db/index.js');

    const mockTx: any = {
      execute: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    await expireStaleSubscriptions();

    // El objeto Sql de drizzle guarda el texto en queryChunks (StringChunk con
    // value: string[], Param/ParamDate con value: string) — extraer recursivamente.
    const sqlObj = mockTx.execute.mock.calls[0][0] as any;
    const chunks: string[] = [];
    const walk = (node: any) => {
      if (typeof node === 'string') { chunks.push(node); return; }
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === 'object') {
        if (Array.isArray(node.queryChunks)) { node.queryChunks.forEach(walk); return; }
        if (Array.isArray(node.value)) { node.value.forEach(walk); return; }
        if (typeof node.value === 'string') { chunks.push(node.value); return; }
      }
    };
    walk(sqlObj);
    const sqlText = chunks.join(' ');
    expect(sqlText).toContain("status = 'pending_approval'");
    expect(sqlText).toContain('FOR UPDATE SKIP LOCKED');
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

  it('C1: guarda el mpSubscriptionId con set directo (null limpia el id viejo)', async () => {
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
      tier: 'free',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    });

    expect(ins.onConflictDoUpdate.mock.calls[0][0].set.mpSubscriptionId).toBeNull();
  });

  it('A1: pending_approval NO otorga el tier al usuario', async () => {
    const { db } = await import('../db/index.js');

    const returningVal = mockReturning([{ id: 'sub-1' }]);
    const ins = mockInsertChain(returningVal);

    vi.mocked(db.insert).mockImplementation(ins.insert);
    vi.mocked(db.update).mockImplementation(vi.fn());
    vi.mocked(db.select).mockReturnValue({} as any);

    await createOrUpdateSubscription('user-1', {
      mpSubscriptionId: 'mp-x',
      tier: 'pro',
      status: 'pending_approval',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    });

    expect(db.update).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('A5: congela el exceso de eventos activos al bajar de tier (downgrade)', async () => {
    const { db } = await import('../db/index.js');

    const returningVal = mockReturning([{ id: 'sub-1' }]);
    const ins = mockInsertChain(returningVal);
    const upd = mockUpdateChain();
    // El count devuelve 3 eventos activos (free maxEvents=1 → exceso = 2)
    const sel = mockSelectChain([{ count: 3 }]);

    vi.mocked(db.insert).mockImplementation(ins.insert);
    vi.mocked(db.update).mockImplementation(upd.update);
    vi.mocked(db.select).mockImplementation(sel.select);

    await createOrUpdateSubscription('user-1', {
      mpSubscriptionId: 'mp-x',
      tier: 'free',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    });

    // free maxEvents=1 → exceso = 2 → el select del exceso pide limit 2
    expect(sel.limit).toHaveBeenCalledWith(2);
  });
});

describe('cancelSubscription (inmediata)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('M3: restaura el evento kept del plan free tras congelar', async () => {
    const { db } = await import('../db/index.js');

    const mockTx: any = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockSub]),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'kept-ev' }]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    await cancelSubscription('user-1', true);

    // subs + users + freeze(events) + restore kept(events) = 4 updates
    expect(mockTx.update).toHaveBeenCalledTimes(4);
    expect(mockTx.limit).toHaveBeenCalledWith(1);
  });
});

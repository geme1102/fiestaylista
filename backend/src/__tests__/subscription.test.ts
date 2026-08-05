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
  pendingMpCancellations: {},
  pendingCloudinaryDeletes: {},
}));

const mockMp = vi.hoisted(() => ({
  fetchPreapprovalInfo: vi.fn(),
  cancelPreapproval: vi.fn().mockResolvedValue(undefined),
  retryable: vi.fn(async (fn: (opts: { signal?: AbortSignal; timeout?: number }) => Promise<unknown>) => fn({})),
}));

vi.mock('../services/mercadopago.js', () => mockMp);

// F5: solo el destroy de Cloudinary se mockea; las funciones puras (URL parsing)
// siguen siendo las reales para no alterar los tests existentes de purge.
vi.mock('../utils/cloudinary.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/cloudinary.js')>();
  return {
    ...actual,
    destroyWithRetry: vi.fn().mockResolvedValue(true),
  };
});

import {
  cancelSubscription,
  getCurrentSubscription,
  createOrUpdateSubscription,
  reconcileSubscriptionOnLogin,
  updateSubscriptionStatus,
} from '../services/subscription.js';
import {
  expireStaleSubscriptions,
  retryPendingCancellations,
  retryPendingMpCancellations,
  retryPendingCloudinaryDeletes,
} from '../services/subscription-cron.js';

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
    const extract = (sqlObj: any) => {
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
      return chunks.join(' ');
    };

    // M6: la primera query expira filas 'incomplete' huérfanas sin congelar eventos
    const incompleteSql = extract(mockTx.execute.mock.calls[0][0]);
    expect(incompleteSql).toContain("status = 'incomplete'");

    // La segunda query es la de expiración estándar con pending_approval
    const staleSql = extract(mockTx.execute.mock.calls[1][0]);
    expect(staleSql).toContain("status = 'pending_approval'");
    expect(staleSql).toContain('FOR UPDATE SKIP LOCKED');
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

  it('A5: congela el exceso en orden ASC (viejos primero — los nuevos quedan activos)', async () => {
    const { db } = await import('../db/index.js');

    const returningVal = mockReturning([{ id: 'sub-1' }]);
    const ins = mockInsertChain(returningVal);
    const upd = mockUpdateChain();
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

    const extract = (node: any): string => {
      const out: string[] = [];
      const walk = (n: any) => {
        if (typeof n === 'string') { out.push(n); return; }
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if (n && typeof n === 'object') {
          if (Array.isArray(n.queryChunks)) { n.queryChunks.forEach(walk); return; }
          if (Array.isArray(n.value)) { n.value.forEach(walk); return; }
          if (typeof n.value === 'string') { out.push(n.value); return; }
        }
      };
      walk(node);
      return out.join(' ');
    };

    const orderSql = extract(sel.orderBy.mock.calls[0][0]);
    expect(orderSql).toContain('asc');
    expect(orderSql).not.toContain('desc');
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

  it('H2: guarda cancelRequestedAt sin degradar tier (cancelación no inmediata)', async () => {
    const { db } = await import('../db/index.js');

    const mockTx: any = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ ...mockSub, status: 'canceled' }]),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    await cancelSubscription('user-1', false);

    const subsSet = mockTx.set.mock.calls.find((c: any[]) => Object.prototype.hasOwnProperty.call(c[0], 'cancelRequestedAt'))[0];
    expect(subsSet.cancelRequestedAt).toBeInstanceOf(Date);
    expect(subsSet).not.toHaveProperty('tier');
  });

  it('H2: cancelación inmediata guarda cancelRequestedAt y degrada tier a free', async () => {
    const { db } = await import('../db/index.js');

    const mockTx: any = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ ...mockSub, status: 'canceled', tier: 'free' }]),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'kept-ev' }]),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(mockTx));

    await cancelSubscription('user-1', true);

    const subsSet = mockTx.set.mock.calls.find((c: any[]) => Object.prototype.hasOwnProperty.call(c[0], 'cancelRequestedAt'))[0];
    expect(subsSet.cancelRequestedAt).toBeInstanceOf(Date);
    expect(subsSet.tier).toBe('free');
  });
});

describe('reconcileSubscriptionOnLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMp.fetchPreapprovalInfo.mockReset();
  });

  it('H2: NO reactiva una sub con cancelación pendiente (cancelRequestedAt)', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ ...mockSub, status: 'canceled', cancelRequestedAt: new Date() }]),
        }),
      }),
    } as any);

    await reconcileSubscriptionOnLogin('user-1');

    expect(mockMp.fetchPreapprovalInfo).not.toHaveBeenCalled();
  });

  it('reactiva una sub cancelada sin intención de cancelación si MP sigue cobrando', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ ...mockSub, status: 'canceled', cancelRequestedAt: null }]),
        }),
      }),
    } as any);

    mockMp.fetchPreapprovalInfo.mockResolvedValue({
      status: 'active',
      nextChargeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      externalReference: 'pro_user-1_month',
      dateCreated: new Date().toISOString(),
      transactionAmount: 8900,
      amountSource: 'initial',
    });

    const returningVal = mockReturning([{ id: 'sub-1' }]);
    const ins = mockInsertChain(returningVal);
    const upd = mockUpdateChain();
    const sel = mockSelectChain([{ id: 'evt-1' }]);
    vi.mocked(db.insert).mockImplementation(ins.insert);
    vi.mocked(db.update).mockImplementation(upd.update);
    vi.mocked(db.select).mockImplementation(sel.select);

    await reconcileSubscriptionOnLogin('user-1');

    expect(mockMp.fetchPreapprovalInfo).toHaveBeenCalledWith('mp-1');
    expect(ins.insert).toHaveBeenCalled();
    expect(ins.onConflictDoUpdate.mock.calls[0][0].set).toEqual(expect.objectContaining({ status: 'active' }));
  });
});

describe('retryPendingCancellations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMp.fetchPreapprovalInfo.mockReset();
    mockMp.cancelPreapproval.mockClear();
  });

  it('H2: cancela en MP y limpia cancelRequestedAt cuando sigue cobrando', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'sub-1', userId: 'user-1', mpSubscriptionId: 'mp-1' }]),
        }),
      }),
    } as any);
    const upd = mockUpdateChain();
    vi.mocked(db.update).mockImplementation(upd.update);
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ status: 'active' });

    const count = await retryPendingCancellations();

    expect(count).toBe(1);
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('mp-1');
    expect(upd.set).toHaveBeenCalledWith(expect.objectContaining({ cancelRequestedAt: null }));
    expect(upd.where).toHaveBeenCalled();
  });

  it('H2: no llama a MP cuando el preapproval ya no cobra; igual limpia la intención', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'sub-1', userId: 'user-1', mpSubscriptionId: 'mp-1' }]),
        }),
      }),
    } as any);
    const upd = mockUpdateChain();
    vi.mocked(db.update).mockImplementation(upd.update);
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ status: 'cancelled' });

    const count = await retryPendingCancellations();

    expect(count).toBe(1);
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
    expect(upd.set).toHaveBeenCalledWith(expect.objectContaining({ cancelRequestedAt: null }));
  });

  it('H2: si MP falla, la intención queda pendiente para el siguiente reintento', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'sub-1', userId: 'user-1', mpSubscriptionId: 'mp-1' }]),
        }),
      }),
    } as any);
    const upd = mockUpdateChain();
    vi.mocked(db.update).mockImplementation(upd.update);
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ status: 'active' });
    mockMp.cancelPreapproval.mockRejectedValueOnce(new Error('MP down'));

    const count = await retryPendingCancellations();

    expect(count).toBe(0);
    expect(upd.set).not.toHaveBeenCalled();
  });
});

describe('retryPendingMpCancellations', () => {
  const pendingCancel = {
    id: 'pc-1',
    userId: 'user-1',
    mpSubscriptionId: 'mp-orphan',
    attempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ status: 'active' });
    mockMp.cancelPreapproval.mockResolvedValue(undefined);
    mockMp.retryable.mockImplementation(async (fn: any) => fn({}));
  });

  it('C2: cancela en MP y borra la fila cuando el preapproval sigue cobrando', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([pendingCancel]),
        }),
      }),
    } as any);
    const del = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: del } as any);

    const count = await retryPendingMpCancellations();

    expect(count).toBe(1);
    expect(mockMp.fetchPreapprovalInfo).toHaveBeenCalledWith('mp-orphan');
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('mp-orphan');
    expect(del).toHaveBeenCalled();
  });

  it('C2: no llama a MP si el preapproval ya no cobra; igual borra la fila', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([pendingCancel]),
        }),
      }),
    } as any);
    const del = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: del } as any);
    mockMp.fetchPreapprovalInfo.mockResolvedValue({ status: 'cancelled' });

    const count = await retryPendingMpCancellations();

    expect(count).toBe(1);
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalled();
  });

  it('C2: si MP falla, incrementa attempts y programa el backoff (reintento persistente)', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ ...pendingCancel, attempts: 2 }]),
        }),
      }),
    } as any);
    const upd = mockUpdateChain();
    vi.mocked(db.update).mockImplementation(upd.update);
    mockMp.cancelPreapproval.mockRejectedValueOnce(new Error('MP down'));

    const count = await retryPendingMpCancellations();

    expect(count).toBe(0);
    expect(upd.set).toHaveBeenCalledWith(expect.objectContaining({ attempts: 3 }));
    expect(upd.where).toHaveBeenCalled();
    const setArgs = upd.set.mock.calls[0][0] as any;
    expect(setArgs.nextRetryAt.getTime()).toBeGreaterThan(Date.now() + 7 * 60 * 1000);
  });
});

describe('retryPendingCloudinaryDeletes', () => {
  const pendingDelete = {
    id: 'pd-1',
    userId: 'user-1',
    publicId: 'fiestaylista/events/photo-1',
    attempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const { destroyWithRetry } = await import('../utils/cloudinary.js');
    vi.mocked(destroyWithRetry).mockResolvedValue(true);
  });

  it('F5: borra en Cloudinary y elimina la fila pendiente cuando el destroy tiene éxito', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([pendingDelete]),
        }),
      }),
    } as any);
    const del = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: del } as any);
    const { destroyWithRetry } = await import('../utils/cloudinary.js');

    const count = await retryPendingCloudinaryDeletes();

    expect(count).toBe(1);
    expect(destroyWithRetry).toHaveBeenCalledWith('fiestaylista/events/photo-1');
    expect(del).toHaveBeenCalled();
  });

  it('F5: si Cloudinary no confirma el borrado (false), NO borra la fila y programa backoff', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ ...pendingDelete, attempts: 2 }]),
        }),
      }),
    } as any);
    const del = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: del } as any);
    const upd = mockUpdateChain();
    vi.mocked(db.update).mockImplementation(upd.update);
    const { destroyWithRetry } = await import('../utils/cloudinary.js');
    vi.mocked(destroyWithRetry).mockResolvedValue(false);

    const count = await retryPendingCloudinaryDeletes();

    expect(count).toBe(0);
    expect(del).not.toHaveBeenCalled();
    expect(upd.set).toHaveBeenCalledWith(expect.objectContaining({ attempts: 3 }));
    const setArgs = upd.set.mock.calls[0][0] as any;
    expect(setArgs.nextRetryAt.getTime()).toBeGreaterThan(Date.now() + 7 * 60 * 1000);
  });

  it('F5: si el destroy lanza, incrementa attempts y programa backoff (reintento persistente)', async () => {
    const { db } = await import('../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([pendingDelete]),
        }),
      }),
    } as any);
    const upd = mockUpdateChain();
    vi.mocked(db.update).mockImplementation(upd.update);
    const { destroyWithRetry } = await import('../utils/cloudinary.js');
    vi.mocked(destroyWithRetry).mockRejectedValueOnce(new Error('Cloudinary down'));

    const count = await retryPendingCloudinaryDeletes();

    expect(count).toBe(0);
    expect(upd.set).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
    expect(upd.where).toHaveBeenCalled();
  });
});

describe('updateSubscriptionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('M6: incomplete congela eventos y restaura el evento kept del plan free', async () => {
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

    await updateSubscriptionStatus('user-1', 'incomplete');

    // subs + users(free) + freeze(events) + restore kept(events) = 4 updates
    expect(mockTx.update).toHaveBeenCalledTimes(4);
    expect(mockTx.limit).toHaveBeenCalledWith(1);
    const usersSet = mockTx.set.mock.calls[1][0];
    expect(usersSet).toEqual(expect.objectContaining({ tier: 'free' }));
  });
});

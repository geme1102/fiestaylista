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

vi.mock('../services/mercadopago.js', () => ({
  createContributionPreference: vi.fn(),
}));

import { createPromise, completeContribution, revertContribution, getPromisedAmount } from '../services/cashFund.js';

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
    limit: vi.fn(),
    returning: vi.fn(),
  };
}

describe('createPromise (C1) — no infla collectedAmount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza monto menor al mínimo', async () => {
    await expect(createPromise('fund-1', 'Ana', 1999)).rejects.toThrow('monto mínimo es $2,000');
  });

  it('rechaza nombre vacío tras sanitización', async () => {
    await expect(createPromise('fund-1', '<>', 5000)).rejects.toThrow('nombre es requerido');
  });

  it('NO incrementa collectedAmount del fondo (la promesa no es dinero cobrado)', async () => {
    const { db } = await import('../db/index.js');

    const mockFund = { id: 'fund-1', eventId: 'event-1', isActive: true };
    const mockEvent = { id: 'event-1' };
    const mockContribution = { id: 'c-1', cashFundId: 'fund-1', contributorName: 'Ana', amount: 50000, status: 'promised' };

    const tx = createMockTx();
    let limitCount = 0;
    tx.limit.mockImplementation(() => {
      limitCount++;
      if (limitCount === 1) return Promise.resolve([mockFund]);
      if (limitCount === 2) return Promise.resolve([mockEvent]);
      if (limitCount === 3) return Promise.resolve([]); // no existing promise
      return Promise.resolve([]);
    });
    tx.returning.mockResolvedValue([mockContribution]);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    // getPromisedAmount usa db.select directamente
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ total: 50000 }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const result = await createPromise('fund-1', 'Ana', 50000);

    expect(result.contribution.id).toBe('c-1');
    expect(result.promisedTotal).toBe(50000);
    // CRÍTICO: nunca se llama a update sobre cashFunds dentro ni fuera de la tx
    expect(tx.update).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('reutiliza una promesa existente del mismo nombre+monto (idempotencia suave)', async () => {
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
      if (limitCount === 3) return Promise.resolve([existing]); // ya existe
      return Promise.resolve([]);
    });
    tx.returning.mockResolvedValue([{ id: 'existing-1', message: 'nuevo', status: 'promised' }]);

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ total: 50000 }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    await createPromise('fund-1', 'Ana', 50000, 'nuevo');

    // NO se inserta nada nuevo, se actualiza el existente
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledTimes(1); // update del message del existente
    expect(db.update).not.toHaveBeenCalled(); // pero NO del cashFunds.collectedAmount
  });
});

describe('completeContribution / revertContribution (C5) — atomicidad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('completeContribution ejecuta ambos UPDATE dentro de una transacción', async () => {
    const { db } = await import('../db/index.js');
    const tx = createMockTx();
    const completed = { id: 'c-1', cashFundId: 'fund-1', netAmount: 9470 };
    tx.returning.mockResolvedValue([completed]);

    let txUsed = false;
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      txUsed = true;
      return cb(tx);
    });

    await completeContribution('c-1', 'mp-123');

    expect(txUsed).toBe(true); // atómico
    expect(tx.update).toHaveBeenCalledTimes(2); // contribution + cashFunds
  });

  it('completeContribution no actualiza el fondo si la contribución no estaba pending', async () => {
    const { db } = await import('../db/index.js');
    const tx = createMockTx();
    tx.returning.mockResolvedValue([]); // no row matched (not pending)

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));

    await completeContribution('c-1');

    expect(tx.update).toHaveBeenCalledTimes(1); // solo el intento sobre la contribution
  });

  it('revertContribution ejecuta ambos UPDATE dentro de una transacción', async () => {
    const { db } = await import('../db/index.js');
    const tx = createMockTx();
    const refunded = { id: 'c-1', cashFundId: 'fund-1', netAmount: 9470 };
    tx.returning.mockResolvedValue([refunded]);

    let txUsed = false;
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      txUsed = true;
      return cb(tx);
    });

    await revertContribution('c-1');

    expect(txUsed).toBe(true);
    expect(tx.update).toHaveBeenCalledTimes(2);
  });
});

describe('getPromisedAmount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 0 cuando no hay promesas', async () => {
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

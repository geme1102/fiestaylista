import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  users: {},
  events: {},
  gifts: {},
  photos: {},
  cashFunds: {},
  cashContributions: {},
  subscriptions: {},
  consentRecords: {},
  arcoRequests: {},
  refreshTokens: {},
  pendingMpCancellations: {},
}));

vi.mock('../utils/errors.js', () => ({
  NotFoundError: class NotFoundError extends Error {},
}));

vi.mock('../utils/cloudinary.js', () => ({
  getPublicIdFromUrl: (url: string) => url.split('/').pop()?.split('.')[0] ?? null,
  isOwnCloudinaryUrl: () => true,
  destroyWithRetry: vi.fn().mockResolvedValue(true),
}));

const mockMp = vi.hoisted(() => ({
  cancelPreapproval: vi.fn().mockResolvedValue(undefined),
  searchPreapprovalsByRefAll: vi.fn().mockResolvedValue([]),
  retryable: vi.fn(async (fn: (opts: { signal?: AbortSignal; timeout?: number }) => Promise<unknown>) => fn({})),
}));

vi.mock('../services/mercadopago.js', () => mockMp);

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
}));

import { deleteUserAccount } from '../services/arco.js';

const mockUser = {
  id: 'user-1',
  email: 'user@test.com',
  name: 'Usuario',
  tier: 'pro',
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function mockSelectChain(result: unknown, withLimit = false) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => (withLimit ? { limit: vi.fn().mockResolvedValue(result) } : result)),
    })),
  };
}

async function mockDbSequence(
  usersResult: unknown[] = [mockUser],
  subsResult: unknown[] = [],
  eventsResult: unknown[] = [],
  photosResult: unknown[] = [],
) {
  const { db } = await import('../db/index.js');
  // Siempre 4 once (users, subscriptions, events, photos): si un select queda
  // sin consumir no hay filtración al siguiente test gracias a resetAllMocks.
  vi.mocked(db.select)
    .mockReturnValueOnce(mockSelectChain(usersResult, true) as any)
    .mockReturnValueOnce(mockSelectChain(subsResult) as any)
    .mockReturnValueOnce(mockSelectChain(eventsResult) as any)
    .mockReturnValueOnce(mockSelectChain(photosResult) as any);
  return db;
}

async function mockTransaction() {
  const { db } = await import('../db/index.js');
  const tx: any = {
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  };
  vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(tx));
  return tx;
}

async function awaitImportDb() {
  return import('../db/index.js');
}

function sub(status: string, mpSubscriptionId: string | null, cancelRequestedAt: Date | null = null) {
  return { mpSubscriptionId, status, cancelRequestedAt };
}

beforeEach(async () => {
  // resetAllMocks (no clearAllMocks): limpia también los mockReturnValueOnce
  // no consumidos que de otro modo se filtran al test siguiente. Las
  // implementaciones base de los mock factories se restauran aquí (resetAllMocks
  // las borra, y arco.ts depende de retryable → fn y destroyWithRetry → true).
  vi.resetAllMocks();
  mockMp.searchPreapprovalsByRefAll.mockResolvedValue([]);
  mockMp.cancelPreapproval.mockResolvedValue(undefined);
  mockMp.retryable.mockImplementation(async (fn: any) => fn({}));
  const { destroyWithRetry } = await import('../utils/cloudinary.js');
  vi.mocked(destroyWithRetry).mockResolvedValue(true);
});

describe('deleteUserAccount', () => {
  it('C2: cancela preapprovals de subs active, past_due y pending_approval (no solo active)', async () => {
    await mockDbSequence([mockUser], [
      sub('active', 'PA-ACTIVE'),
      sub('past_due', 'PA-PAST'),
      sub('pending_approval', 'PA-PENDING'),
    ]);
    await mockTransaction();

    await deleteUserAccount('user-1');

    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-ACTIVE');
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-PAST');
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-PENDING');
  });

  it('C2: no cancela subs canceled sin cancelación MP pendiente (ya resueltas)', async () => {
    await mockDbSequence([mockUser], [
      sub('canceled', 'PA-DONE', null),
      sub('canceled', 'PA-PENDING-MP', new Date()),
    ]);
    await mockTransaction();

    await deleteUserAccount('user-1');

    expect(mockMp.cancelPreapproval).not.toHaveBeenCalledWith('PA-DONE');
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-PENDING-MP');
  });

  it('C2: busca preapprovals huérfanos por external_reference en todos los estados y los cancela', async () => {
    mockMp.searchPreapprovalsByRefAll.mockImplementation((ref: string) => {
      if (ref === 'pro_user-1_month') return Promise.resolve([{ id: 'PA-HUERFANO', status: 'active' }]);
      if (ref === 'pro_plus_user-1_year') return Promise.resolve([{ id: 'PA-ORPHAN2', status: 'pending' }]);
      return Promise.resolve([]);
    });
    await mockDbSequence([mockUser], []);
    await mockTransaction();

    await deleteUserAccount('user-1');

    expect(mockMp.searchPreapprovalsByRefAll).toHaveBeenCalledWith('pro_user-1_month');
    expect(mockMp.searchPreapprovalsByRefAll).toHaveBeenCalledWith('pro_user-1_year');
    expect(mockMp.searchPreapprovalsByRefAll).toHaveBeenCalledWith('pro_plus_user-1_month');
    expect(mockMp.searchPreapprovalsByRefAll).toHaveBeenCalledWith('pro_plus_user-1_year');
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-HUERFANO');
    expect(mockMp.cancelPreapproval).toHaveBeenCalledWith('PA-ORPHAN2');
  });

  it('C2: si cancelar falla, registra la intención en pending_mp_cancellations para reintento persistente', async () => {
    await mockDbSequence([mockUser], [sub('active', 'PA-FALLING')]);
    await mockTransaction();
    const { db } = await awaitImportDb();
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    vi.mocked(db.insert).mockReturnValue({ values } as any);
    mockMp.cancelPreapproval.mockRejectedValueOnce(new Error('MP down'));

    await deleteUserAccount('user-1');

    expect(db.insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({ userId: 'user-1', mpSubscriptionId: 'PA-FALLING' });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it('C2: la eliminación de DB y el borrado de Cloudinary siguen funcionando con fotos', async () => {
    const { destroyWithRetry } = await import('../utils/cloudinary.js');
    await mockDbSequence(
      [mockUser],
      [sub('active', 'PA-A')],
      [{ id: 'event-1' }],
      [{ url: 'https://res.cloudinary.com/x/image/upload/v1/events/photo-1.jpg' }],
    );
    const tx = await mockTransaction();
    await mockMpCancelAll();

    await deleteUserAccount('user-1');

    expect(tx.delete).toHaveBeenCalledTimes(2);
    expect(destroyWithRetry).toHaveBeenCalledWith('photo-1');
  });

  it('lanza NotFoundError si el usuario no existe', async () => {
    await mockDbSequence([]);

    await expect(deleteUserAccount('user-nope')).rejects.toThrow('Usuario no encontrado');
    expect(mockMp.cancelPreapproval).not.toHaveBeenCalled();
  });
});

async function mockMpCancelAll() {
  mockMp.cancelPreapproval.mockResolvedValue(undefined);
}

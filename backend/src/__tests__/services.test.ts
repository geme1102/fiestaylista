import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    FRONTEND_URL: 'http://localhost:5173',
    FROM_EMAIL: 'test@test.com',
    RESEND_API_KEY: 're_test',
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(() => 'mock-token'), verify: vi.fn(() => ({ userId: 'u1', email: 'test@test.com', type: 'access' })) },
  sign: vi.fn(() => 'mock-token'),
  verify: vi.fn(() => ({ userId: 'u1', email: 'test@test.com', type: 'access' })),
  TokenExpiredError: class extends Error { constructor() { super('Token expired'); this.name = 'TokenExpiredError'; } },
}));

vi.mock('../db/index.js', () => {
  const createChain = () => {
    const chain: any = {
      select: vi.fn(() => chain),
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      set: vi.fn(() => chain),
      values: vi.fn(() => chain),
      returning: vi.fn(() => chain),
      execute: vi.fn().mockResolvedValue([]),
      onConflictDoNothing: vi.fn(() => chain),
      onConflictDoUpdate: vi.fn(() => chain),
    };
    return chain;
  };

  const createInsertChain = () => {
    const chain = createChain();
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    return chain;
  };

  const db = {
    select: vi.fn(() => createChain()),
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => createChain()),
    delete: vi.fn(() => createChain()),
    transaction: vi.fn(async (cb: any) => cb(db)),
    execute: vi.fn().mockResolvedValue([]),
    $client: { connect: vi.fn(), end: vi.fn() },
  };

  return { db, sql: vi.fn(() => Promise.resolve([])), eq: vi.fn((a: any, b: any) => ({ a, b })), and: vi.fn((...a: any[]) => a), or: vi.fn((...a: any[]) => a), isNull: vi.fn((c: any) => c), desc: vi.fn((c: any) => c) };
});

vi.mock('../db/schema.js', () => ({ users: {}, refreshTokens: {}, events: {}, gifts: {}, giftClaims: {}, photos: {}, subscriptions: {}, cashFunds: {}, cashContributions: {}, messages: {}, guests: {}, auditLogs: {} }));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn().mockResolvedValue('hash'), genSalt: vi.fn().mockResolvedValue('salt'), hashSync: vi.fn(() => 'hash') },
  compare: vi.fn().mockResolvedValue(true),
  hash: vi.fn().mockResolvedValue('hash'),
  genSalt: vi.fn().mockResolvedValue('salt'),
  hashSync: vi.fn(() => 'hash'),
}));

vi.mock('../services/email.js', () => ({
  isEmailConfigured: vi.fn(() => true),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

function queryMock(selectResults: any[][] = []) {
  let selectIdx = 0;
  const q: any = {};
  q.select = vi.fn(() => q);
  q.from = vi.fn(() => q);
  q.innerJoin = vi.fn(() => q);
  q.where = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.offset = vi.fn(() => q);
  q.orderBy = vi.fn(() => q);
  q.groupBy = vi.fn(() => q);
  q.for = vi.fn(() => q);
  q.set = vi.fn(() => q);
  q.values = vi.fn(() => q);
  q.delete = vi.fn(() => q);
  q.execute = vi.fn().mockResolvedValue(undefined);
  q._insertResult = [{ id: 'mock' }];
  q._updateResult = [{ id: 'mock' }];
  q.onConflictDoNothing = vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(q._insertResult)) }));
  q.returning = vi.fn(() => Promise.resolve(q._updateResult));
  q.insert = vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(q._insertResult)) })), returning: vi.fn(() => Promise.resolve(q._insertResult)) })) }));
  q.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(q._updateResult)) })) })) }));
  Object.defineProperty(q, 'then', {
    value: (resolve: (value: any[] | PromiseLike<any[]>) => void) => {
      const r = selectIdx < selectResults.length ? selectResults[selectIdx] : [];
      selectIdx++;
      return Promise.resolve(r).then(resolve);
    },
    writable: true,
  });
  return q;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('Auth Service', () => {
  describe('hashToken', () => {
    it('returns a hex string', async () => {
      const { hashToken } = await import('../services/auth-tokens.js');
      expect(hashToken('test-token')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('register', () => {
    it('creates user and returns tokens', async () => {
      const { db } = await import('../db/index.js');
      const { register } = await import('../services/auth.js');
      const tx = queryMock([[]]);
      tx._insertResult = [{ id: 'u1', email: 'test@test.com', name: 'Test', tier: 'free', emailVerified: false, createdAt: new Date(), passwordHash: 'hash' }];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await register('test@test.com', 'password123', 'Test');
      expect(result.user.email).toBe('test@test.com');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBeTruthy();
      expect(typeof result.refreshToken).toBe('string');
    });

    it('throws for guest domain', async () => {
      const { register } = await import('../services/auth.js');
      await expect(register('x@guest.fiestaylista.com', 'p', 'T')).rejects.toThrow('no está disponible');
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const { db, sql } = await import('../db/index.js');
      const { login } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ count: 0 }]]));
      vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);
      vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as any);
      vi.mocked(sql).mockResolvedValueOnce([{ id: 'u1', email: 'test@test.com', password_hash: 'hash', name: 'T', tier: 'free', email_verified: true, created_at: new Date() }] as any);
      const result = await login('test@test.com', 'password123');
      expect(result.user.email).toBe('test@test.com');
    });

    it('throws for unknown user', async () => {
      const { db } = await import('../db/index.js');
      const { login } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[]]));
      vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);
      await expect(login('no@one.com', 'p')).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('getUser', () => {
    it('returns user', async () => {
      const { sql } = await import('../db/index.js');
      const { getUser } = await import('../services/auth.js');
      vi.mocked(sql).mockResolvedValueOnce([{ id: 'u1', email: 'e@e.com', name: 'N', tier: 'free', email_verified: true, created_at: new Date() }] as any);
      const user = await getUser('u1');
      expect(user.email).toBe('e@e.com');
    });

    it('throws if not found', async () => {
      const { getUser } = await import('../services/auth.js');
      await expect(getUser('x')).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('verifyEmail', () => {
    it('verifies with valid token', async () => {
      const { db } = await import('../db/index.js');
      const { verifyEmail } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'u1', verificationToken: 't', verificationTokenExpires: new Date(Date.now() + 1e6) }]]));
      vi.mocked(db.update).mockReturnValue(queryMock([]));
      await expect(verifyEmail('t')).resolves.toBeUndefined();
    });

    it('throws for invalid token', async () => {
      const { db } = await import('../db/index.js');
      const { verifyEmail } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[]]));
      await expect(verifyEmail('bad')).rejects.toThrow('Token de verificación inválido');
    });
  });

  describe('forgotPassword', () => {
    it('sends reset email for existing user', async () => {
      const { db } = await import('../db/index.js');
      const { forgotPassword } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'u1', email: 'e@e.com' }]]));
      vi.mocked(db.update).mockReturnValue(queryMock([]));
      await expect(forgotPassword('e@e.com')).resolves.toBeUndefined();
    });

    it('silently succeeds for unknown user', async () => {
      const { db } = await import('../db/index.js');
      const { forgotPassword } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[]]));
      await expect(forgotPassword('x@x.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      const { db } = await import('../db/index.js');
      const { resetPassword } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'u1', resetToken: 't', resetTokenExpires: new Date(Date.now() + 1e6) }]]));
      vi.mocked(db.update).mockReturnValue(queryMock([]));
      await expect(resetPassword('t', 'newpass')).resolves.toBeUndefined();
    });

    it('throws for invalid token', async () => {
      const { db } = await import('../db/index.js');
      const { resetPassword } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[]]));
      await expect(resetPassword('bad', 'p')).rejects.toThrow('Token de restablecimiento inválido');
    });
  });
});

describe('Event Service', () => {
  describe('createEvent', () => {
    it('creates event with generated slug', async () => {
      const { db } = await import('../db/index.js');
      const { createEvent } = await import('../services/event.js');
      const mockEvent = { id: 'e1', title: 'Mi Boda', slug: 'mi-boda', eventType: 'WEDDING', userId: 'u1' };
      const tx = queryMock([[{ tier: 'free' }]]);
      tx._insertResult = [mockEvent];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await createEvent('u1', { title: 'Mi Boda', eventType: 'WEDDING' });
      expect(result.slug).toBe('mi-boda');
    });

    it('H1: permite crear cuando solo hay eventos pausados/congelados (cuenta solo activos)', async () => {
      const { db } = await import('../db/index.js');
      const { createEvent } = await import('../services/event.js');
      const mockEvent = { id: 'e1', title: 'Mi Boda', slug: 'mi-boda', eventType: 'WEDDING', userId: 'u1' };
      const tx = queryMock([[{ tier: 'free' }], [{ count: 0 }]]);
      tx._insertResult = [mockEvent];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await createEvent('u1', { title: 'Mi Boda', eventType: 'WEDDING' });
      expect(result.slug).toBe('mi-boda');
    });

    it('H1: bloquea al alcanzar el límite de eventos ACTIVOS con mensaje "activos"', async () => {
      const { db } = await import('../db/index.js');
      const { createEvent } = await import('../services/event.js');
      const tx = queryMock([[{ tier: 'free' }], [{ count: 1 }]]);
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      await expect(createEvent('u1', { title: 'Mi Boda', eventType: 'WEDDING' }))
        .rejects.toThrow('límite de 1 eventos activos en tu plan free');
    });

    it('A5: devuelve el evento existente si la misma idempotencyKey ya creó uno (sin duplicar)', async () => {
      const { db } = await import('../db/index.js');
      const { createEvent } = await import('../services/event.js');
      const existing = { id: 'e1', title: 'Mi Boda', slug: 'mi-boda', eventType: 'WEDDING', userId: 'u1' };
      const tx = queryMock([[existing]]);
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await createEvent('u1', {
        title: 'Mi Boda',
        eventType: 'WEDDING',
        idempotencyKey: 'e3b0c442-98fc-1c14-9afc-4cfc6daf0a01',
      });
      expect(result).toEqual(existing);
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('A5: el reintento con key existente pasa por alto el límite de eventos', async () => {
      const { db } = await import('../db/index.js');
      const { createEvent } = await import('../services/event.js');
      const existing = { id: 'e1', title: 'Mi Boda', slug: 'mi-boda', eventType: 'WEDDING', userId: 'u1' };
      const tx = queryMock([[existing]]);
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      // El usuario está en su cupo máximo (1/1), pero el reintento con la misma
      // key debe devolver el evento, no fallar por límite.
      const result = await createEvent('u1', {
        title: 'Mi Boda',
        eventType: 'WEDDING',
        idempotencyKey: 'e3b0c442-98fc-1c14-9afc-4cfc6daf0a01',
      });
      expect(result.id).toBe('e1');
    });

    it('A5: sin evento previo, crea el evento y persiste la idempotencyKey en el insert', async () => {
      const { db } = await import('../db/index.js');
      const { createEvent } = await import('../services/event.js');
      const mockEvent = { id: 'e1', title: 'Mi Boda', slug: 'mi-boda', eventType: 'WEDDING', userId: 'u1' };
      const tx = queryMock([[], [{ tier: 'free' }], [{ count: 0 }]]);
      tx._insertResult = [mockEvent];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const key = 'e3b0c442-98fc-1c14-9afc-4cfc6daf0a01';
      const result = await createEvent('u1', { title: 'Mi Boda', eventType: 'WEDDING', idempotencyKey: key });
      expect(result.slug).toBe('mi-boda');
      const valuesArg = (tx.insert as any).mock.results[0].value.values.mock.calls[0][0];
      expect(valuesArg.idempotencyKey).toBe(key);
    });
  });
});

describe('Gift Service', () => {
  describe('addGift', () => {
    it('adds gift after sanitization', async () => {
      const { db } = await import('../db/index.js');
      const { addGift } = await import('../services/gift.js');
      const tx = queryMock([
        [{ isActive: true, userId: 'u1' }],
        [{ tier: 'free' }],
        [{ count: 0 }],
      ]);
      tx._insertResult = [{ id: 'g1', name: 'Regalo', eventId: 'e1' }];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await addGift('e1', 'Regalo');
      expect(result.name).toBe('Regalo');
    });

    it('throws for empty name', async () => {
      const { addGift } = await import('../services/gift.js');
      await expect(addGift('e1', '<>')).rejects.toThrow('El nombre del regalo es requerido');
    });
  });

  describe('claimGift', () => {
    it('claims available gift', async () => {
      const { db } = await import('../db/index.js');
      const { claimGift } = await import('../services/gift.js');
      const tx = queryMock([[{ eventId: 'e1', isClaimed: false }], [{ status: 'active', isActive: true }]]);
      tx._updateResult = [{ id: 'g1', isClaimed: true, claimedBy: 'Ana' }];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await claimGift('g1', 'Ana');
      expect(result.isClaimed).toBe(true);
    });

    it('throws for empty name', async () => {
      const { claimGift } = await import('../services/gift.js');
      await expect(claimGift('g1', '')).rejects.toThrow('El nombre es requerido');
    });

    it('rejects group gifts (must use group-claim)', async () => {
      const { db } = await import('../db/index.js');
      const { claimGift } = await import('../services/gift.js');
      const tx = queryMock([[{ eventId: 'e1', isClaimed: false, isGroupGift: true }]]);
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      await expect(claimGift('g1', 'Ana')).rejects.toThrow('Este regalo es grupal — usa la opción de unirse al grupo');
    });

    it('rejects claim when gift belongs to a different event', async () => {
      const { db } = await import('../db/index.js');
      const { claimGift } = await import('../services/gift.js');
      const tx = queryMock([[{ eventId: 'e1', isClaimed: false, isGroupGift: false }]]);
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      await expect(claimGift('g1', 'Ana', 'e2')).rejects.toThrow('Regalo no encontrado');
    });
  });

  describe('releaseGift', () => {
    it('releases claimed gift', async () => {
      const { db } = await import('../db/index.js');
      const { releaseGift } = await import('../services/gift.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ eventId: 'evt-1', ownerId: 'user-1' }]]));
      const tx = queryMock([]);
      tx._deleteResult = [];
      tx._updateResult = [{ id: 'g1', isClaimed: false, claimedBy: null }];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await releaseGift('g1', 'user-1');
      expect(result.isClaimed).toBe(false);
    });
  });

  describe('getEventGifts', () => {
    it('returns gifts (C1)', async () => {
      const { db } = await import('../db/index.js');
      const { getEventGifts } = await import('../services/gift.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'g1', name: 'Gift' }]]));
      const result = await getEventGifts('e1');
      expect(result.gifts).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('marca hasMore cuando hay más de limit filas (C1)', async () => {
      const { db } = await import('../db/index.js');
      const { getEventGifts } = await import('../services/gift.js');
      const rows = Array.from({ length: 51 }, (_, i) => ({ id: `g${i}`, name: `Gift ${i}` }));
      vi.mocked(db.select).mockReturnValue(queryMock([rows]));
      const result = await getEventGifts('e1', { limit: 50 });
      expect(result.gifts).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('addGroupClaim', () => {
    it('rejects when gift belongs to a different event', async () => {
      const { db } = await import('../db/index.js');
      const { addGroupClaim } = await import('../services/gift.js');
      const tx = queryMock([[{ isGroupGift: true, isClaimed: false, eventId: 'e1' }]]);
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      await expect(addGroupClaim('g1', 'Ana', undefined, 'e2')).rejects.toThrow('Regalo no encontrado');
    });

    it('returns friendly error on duplicate participant (23505)', async () => {
      const { db } = await import('../db/index.js');
      const { addGroupClaim } = await import('../services/gift.js');
      const tx = queryMock([
        [{ isGroupGift: true, isClaimed: false, eventId: 'e1' }],
        [{ count: 0 }],
        [{ status: 'active', isActive: true }],
      ]);
      tx.insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue({ code: '23505' }),
        })),
      }));
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      await expect(addGroupClaim('g1', 'Ana', undefined, 'e1')).rejects.toThrow('Ya te has unido a este regalo grupal');
    });
  });

  describe('deleteGift', () => {
    it('deletes the claims of the gift as well', async () => {
      const { db } = await import('../db/index.js');
      const { deleteGift } = await import('../services/gift.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ eventId: 'evt-1' }]]));
      const tx = queryMock([]);
      tx._deleteResult = [];
      tx._updateResult = [{ id: 'g1', deletedAt: new Date() }];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await deleteGift('g1');
      expect(result.success).toBe(true);
      expect(tx.delete).toHaveBeenCalled();
      expect(tx.update).toHaveBeenCalled();
    });
  });

  describe('toggleGroupGift', () => {
    it('releases claim state when converting a reserved gift to group', async () => {
      const { db } = await import('../db/index.js');
      const { toggleGroupGift } = await import('../services/gift.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ eventId: 'evt-1' }]]));
      const tx = queryMock([[{ id: 'g1', isClaimed: true, claimedBy: 'Ana', isGroupGift: false, deletedAt: null }]]);
      tx._updateResult = [{ id: 'g1', isGroupGift: true, claimedBy: null, isClaimed: false }];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      const result = await toggleGroupGift('g1', true);
      expect(result.isGroupGift).toBe(true);
      expect(result.isClaimed).toBe(false);
      expect(result.claimedBy).toBeNull();
    });
  });
});

describe('Event Service', () => {
  describe('updateEvent', () => {
    it('rejects edit when event gets frozen between check and update (TOCTOU)', async () => {
      const { db } = await import('../db/index.js');
      const { updateEvent } = await import('../services/event.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ frozenAt: null }]]));
      const upd = queryMock();
      upd._updateResult = [];
      vi.mocked(db.update).mockReturnValue(upd);
      await expect(updateEvent('e1', 'u1', { title: 'X' })).rejects.toThrow('Este evento está congelado');
    });

    it('reactivation does not overwrite a frozen event (frozenAt guard)', async () => {
      const { db } = await import('../db/index.js');
      const { updateEvent } = await import('../services/event.js');
      const tx = queryMock([
        [{ frozenAt: null }],
        [{ tier: 'free' }],
        [{ count: 0 }],
      ]);
      tx._updateResult = [];
      vi.mocked(db.transaction).mockImplementation((cb: any) => cb(tx));
      await expect(updateEvent('e1', 'u1', { isActive: true })).rejects.toThrow('Este evento está congelado');
    });
  });

  describe('completeEvent', () => {
    it('marks event as inactive so the public page is no longer served', async () => {
      const { db } = await import('../db/index.js');
      const { completeEvent } = await import('../services/event.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'e1', userId: 'u1', status: 'active' }]]));
      const upd = queryMock();
      upd._updateResult = [{ id: 'e1' }];
      const setFn = vi.fn((_data: Record<string, unknown>) => ({ where: vi.fn(() => Promise.resolve(upd._updateResult)) }));
      upd.set = setFn;
      vi.mocked(db.update).mockReturnValue(upd);
      const result = await completeEvent('e1', 'u1');
      expect(result.success).toBe(true);
      const updateData = setFn.mock.calls[0][0];
      expect(updateData.status).toBe('completed');
      expect(updateData.isActive).toBe(false);
    });
  });
});

describe('Email Service', () => {
  it('isEmailConfigured returns true', async () => {
    const { isEmailConfigured } = await import('../services/email.js');
    expect(isEmailConfigured()).toBe(true);
  });

  it('sendVerificationEmail resolves', async () => {
    const { sendVerificationEmail } = await import('../services/email.js');
    await expect(sendVerificationEmail('a@b.com', 't')).resolves.toBeUndefined();
  });
});

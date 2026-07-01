import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_GUEST_SECRET: 'test-guest-secret',
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

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn(), execute: vi.fn() },
  sql: vi.fn((s: any) => ({ toSQL: () => ({ sql: s[0] }) })),
  eq: vi.fn((a: any, b: any) => ({ a, b })),
  and: vi.fn((...a: any[]) => a),
  or: vi.fn((...a: any[]) => a),
  isNull: vi.fn((c: any) => c),
  desc: vi.fn((c: any) => c),
}));

vi.mock('../db/schema.js', () => ({ users: {}, refreshTokens: {}, events: {}, gifts: {}, giftClaims: {}, photos: {}, subscriptions: {}, cashFunds: {}, cashContributions: {}, messages: {}, guests: {} }));

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
  q.where = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.offset = vi.fn(() => q);
  q.orderBy = vi.fn(() => q);
  q.groupBy = vi.fn(() => q);
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
      const { hashToken } = await import('../services/auth.js');
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
      expect(result.refreshToken).toBe('mock-token');
    });

    it('throws for guest domain', async () => {
      const { register } = await import('../services/auth.js');
      await expect(register('x@guest.fiestaylista.com', 'p', 'T')).rejects.toThrow('no está disponible');
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const { db } = await import('../db/index.js');
      const { login } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'u1', email: 'test@test.com', name: 'T', tier: 'free', emailVerified: true, createdAt: new Date(), passwordHash: 'hash' }]]));
      vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);
      vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as any);
      const result = await login('test@test.com', 'password123');
      expect(result.user.email).toBe('test@test.com');
    });

    it('throws for unknown user', async () => {
      const { db } = await import('../db/index.js');
      const { login } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[]]));
      await expect(login('no@one.com', 'p')).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('getUser', () => {
    it('returns user', async () => {
      const { db } = await import('../db/index.js');
      const { getUser } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'u1', email: 'e@e.com', name: 'N', tier: 'free', emailVerified: true, createdAt: new Date() }]]));
      expect((await getUser('u1')).email).toBe('e@e.com');
    });

    it('throws if not found', async () => {
      const { db } = await import('../db/index.js');
      const { getUser } = await import('../services/auth.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[]]));
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
      const selectQ = queryMock([[{ eventId: 'e1' }], [{ status: 'active' }]]);
      vi.mocked(db.select).mockReturnValue(selectQ);
      const updateQ = queryMock([]);
      updateQ._updateResult = [{ id: 'g1', isClaimed: true, claimedBy: 'Ana' }];
      vi.mocked(db.update).mockReturnValue(updateQ);
      const result = await claimGift('g1', 'Ana');
      expect(result.isClaimed).toBe(true);
    });

    it('throws for empty name', async () => {
      const { claimGift } = await import('../services/gift.js');
      await expect(claimGift('g1', '')).rejects.toThrow('El nombre es requerido');
    });
  });

  describe('releaseGift', () => {
    it('releases claimed gift', async () => {
      const { db } = await import('../db/index.js');
      const { releaseGift } = await import('../services/gift.js');
      const q = queryMock([]);
      q._updateResult = [{ id: 'g1', isClaimed: false, claimedBy: null }];
      vi.mocked(db.update).mockReturnValue(q);
      const result = await releaseGift('g1');
      expect(result.isClaimed).toBe(false);
    });
  });

  describe('getEventGifts', () => {
    it('returns gifts', async () => {
      const { db } = await import('../db/index.js');
      const { getEventGifts } = await import('../services/gift.js');
      vi.mocked(db.select).mockReturnValue(queryMock([[{ id: 'g1', name: 'Gift' }]]));
      expect(await getEventGifts('e1')).toHaveLength(1);
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock config antes de importar el middleware (config valida env vars al importar)
vi.mock('../config.js', () => ({
  config: {
    JWT_SECRET: 'test-access-secret-at-least-32-characters-long',
    NODE_ENV: 'test',
  },
}));

// Mock DB para que requireAuth encuentre el usuario con tokenVersion correcto
vi.mock('../db/index.js', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => [{ tokenVersion: 0 }]),
  };
  return { db: chain };
});

import { requireAuth, requireAnyAuth, optionalAuth } from '../middleware/auth.js';

const ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long';

function signAccessToken(userId = 'user-1', email = 'a@b.com', tokenVersion = 0): string {
  return jwt.sign({ userId, email, type: 'access', tokenVersion }, ACCESS_SECRET, { expiresIn: '15m' });
}

function signSseToken(userId = 'user-1'): string {
  return jwt.sign({ eventId: 'ev-1', scope: 'sse', userId }, ACCESS_SECRET, { expiresIn: '2m' });
}

function signGuestSseToken(): string {
  return jwt.sign({ eventId: 'ev-1', scope: 'sse', type: 'guest' }, ACCESS_SECRET, { expiresIn: '2m' });
}

interface MockReq {
  headers: { authorization?: string };
  user?: { userId?: string; email?: string };
}

function buildReq(token?: string): MockReq {
  const req: MockReq = { headers: {} };
  if (token) req.headers.authorization = `Bearer ${token}`;
  return req;
}

function buildRes() {
  return {} as Record<string, unknown>;
}

function buildNext() {
  const next = vi.fn();
  return next;
}

describe('JWT — confusión de tokens SSE (C2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requireAuth acepta un access token válido con type:access', async () => {
    const req = buildReq(signAccessToken());
    const next = buildNext();
    await requireAuth(req as never, buildRes() as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    expect(req.user?.userId).toBe('user-1');
  });

  it('requireAuth RECHAZA un token SSE (scope:sse) usado como access token', async () => {
    const req = buildReq(signSseToken());
    const next = buildNext();
    await requireAuth(req as never, buildRes() as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token inválido' }));
    expect(req.user).toBeUndefined();
  });

  it('requireAnyAuth RECHAZA un token SSE (scope:sse)', async () => {
    const req = buildReq(signSseToken());
    const next = buildNext();
    await requireAnyAuth(req as never, buildRes() as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token inválido' }));
  });

  it('requireAnyAuth RECHAZA un token SSE de invitado (scope:sse, type:guest)', async () => {
    const req = buildReq(signGuestSseToken());
    const next = buildNext();
    await requireAnyAuth(req as never, buildRes() as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token inválido' }));
  });

  it('optionalAuth trata un token SSE como NO autenticado (no asigna user)', async () => {
    const req = buildReq(signSseToken());
    const next = buildNext();
    await optionalAuth(req as never, buildRes() as never, next);
    expect(next).toHaveBeenCalledWith(); // llamado sin error
    expect(req.user).toBeUndefined();
  });

  it('requireAuth rechaza token sin header Authorization', async () => {
    const req = buildReq();
    const next = buildNext();
    await requireAuth(req as never, buildRes() as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token de acceso requerido' }));
  });

  it('requireAuth rechaza token firmado con secreto distinto', async () => {
    const badToken = jwt.sign({ userId: 'u', email: 'a@b.com', type: 'access' }, 'otro-secreto-totalmente-diferente-y-largo', { expiresIn: '15m' });
    const req = buildReq(badToken);
    const next = buildNext();
    await requireAuth(req as never, buildRes() as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/inválido|Token/) }));
    expect(req.user).toBeUndefined();
  });
});

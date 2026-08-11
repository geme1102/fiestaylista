import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// D2-A1: requireAuth/optionalAuth ya no deben emitir SET app.* de RLS
// (PgBouncer los descartaba y la migración 0015 es legacy) — solo el SELECT
// de tokenVersion.
const queryLog = vi.hoisted(() => [] as string[]);

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tokenVersion: 0 }]),
        })),
      })),
    })),
  },
  sql: async (strings: TemplateStringsArray) => {
    queryLog.push(strings.join(''));
  },
}));
vi.mock('../config.js', () => ({ config: { JWT_SECRET: 'test-secret-at-least-32-chars' } }));
vi.mock('../utils/errors.js', () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../db/schema.js', () => ({ users: {} }));
vi.mock('../types/index.js', () => ({}));

import type { AuthRequest } from '../types/index.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const SECRET = 'test-secret-at-least-32-chars';

function validReq(): AuthRequest {
  const token = jwt.sign({ userId: 'u1', email: 'a@b.co', tokenVersion: 0 }, SECRET, { expiresIn: '1h' });
  return { headers: { authorization: `Bearer ${token}` }, user: null } as unknown as AuthRequest;
}

describe('Auth middleware - sin SETs RLS (D2-A1)', () => {
  beforeEach(() => {
    queryLog.length = 0;
  });

  it('requireAuth autentica y no emite ninguna query de SET', async () => {
    const req = validReq();
    const next = vi.fn();
    await requireAuth(req, undefined as never, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect(req.user?.userId).toBe('u1');
    expect(queryLog).toHaveLength(0);
  });

  it('optionalAuth autentica y no emite ninguna query de SET', async () => {
    const req = validReq();
    const next = vi.fn();
    await optionalAuth(req, undefined as never, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.userId).toBe('u1');
    expect(queryLog).toHaveLength(0);
  });
});

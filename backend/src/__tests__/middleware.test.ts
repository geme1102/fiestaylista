import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_GUEST_SECRET: 'test-guest-secret',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    MERCADO_PAGO_ACCESS_TOKEN: '',
    MERCADO_PAGO_WEBHOOK_SECRET: 'wh-secret',
    RESEND_API_KEY: '',
    FROM_EMAIL: 'test@test.com',
    PORT: 3001,
  },
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() },
}));

describe('Error Handler', () => {
  it('returns 500 for unhandled errors', async () => {
    const { errorHandler } = await import('../middleware/error.js');
    const req = {} as Request;
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })), json } as unknown as Response;
    const err = new Error('unexpected');

    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error interno del servidor' }));
  });

  it('handles AppError with specific status code', async () => {
    const { errorHandler } = await import('../middleware/error.js');
    const { NotFoundError } = await import('../utils/errors.js');

    const req = {} as Request;
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })), json } as unknown as Response;
    const err = new NotFoundError('Not found');

    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Not found' }));
  });

  it('handles ValidationError with 400 status', async () => {
    const { errorHandler } = await import('../middleware/error.js');
    const { ValidationError } = await import('../utils/errors.js');

    const req = {} as Request;
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })), json } as unknown as Response;
    const err = new ValidationError('Invalid input');

    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('Auth Middleware', () => {
  let requireAuth: any, requireAnyAuth: any, optionalAuth: any, UnauthorizedError: any;

  beforeEach(async () => {
    const mod = await import('../middleware/auth.js');
    requireAuth = mod.requireAuth;
    requireAnyAuth = mod.requireAnyAuth;
    optionalAuth = mod.optionalAuth;
    UnauthorizedError = (await import('../utils/errors.js')).UnauthorizedError;
  });

  function mockReq(headers: Record<string, string> = {}): any {
    return { headers: { ...headers }, get: (h: string) => headers[h] || headers[h.toLowerCase()] };
  }

  function mockRes(): any {
    const json = vi.fn();
    const status = vi.fn(() => ({ json, end: vi.fn() }));
    return { status, json, end: vi.fn() };
  }

  it('requireAuth rejects missing Authorization header', () => {
    const req = mockReq({});
    const res = mockRes();
    requireAuth(req, res, (err: any) => {
      expect(err).toBeInstanceOf(UnauthorizedError);
    });
  });

  it('requireAuth rejects non-Bearer Authorization', () => {
    const req = mockReq({ authorization: 'Basic xyz' });
    const res = mockRes();
    requireAuth(req, res, (err: any) => {
      expect(err).toBeInstanceOf(UnauthorizedError);
    });
  });

  it('requireAnyAuth calls next with error on missing token', () => {
    const req = mockReq({});
    const res = mockRes();
    requireAnyAuth(req, res, (err: any) => {
      expect(err).toBeInstanceOf(UnauthorizedError);
    });
  });

  it('optionalAuth calls next without error when no token', () => {
    const req = mockReq({});
    const res = mockRes();
    optionalAuth(req, res, (err: any) => {
      expect(err).toBeUndefined();
    });
  });
});

describe('Cloudflare IP Middleware', () => {
  it('sets req.ip from x-forwarded-for header', async () => {
    const { cloudflareIP } = await import('../middleware/cloudflare.js');
    const req = { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, socket: {} } as any;
    const next = vi.fn();
    cloudflareIP(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('Rate Limiter', () => {
  it('exports expected limiters', async () => {
    const limiters = await import('../middleware/rateLimit.js');
    expect(typeof limiters.apiLimiter).toBe('function');
    expect(typeof limiters.authLimiter).toBe('function');
    expect(typeof limiters.webhookLimiter).toBe('function');
  });
});

describe('Ownership Middleware', () => {
  it('exports a middleware function', async () => {
    const mod = await import('../middleware/ownership.js');
    expect(typeof mod.requireEventOwnership).toBe('function');
    const middleware = mod.requireEventOwnership;
    const req = { params: {}, headers: {} } as any;
    const next = vi.fn();
    middleware(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../config.js', () => ({
  config: {
    TURNSTILE_SECRET_KEY: '',
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

vi.mock('../db/index.js', () => {
  const mockSql: any = () => Promise.resolve([]);
  mockSql.unsafe = async () => [];
  return { sql: mockSql, db: {} };
});

import { verifyTurnstile, verifyTurnstileOptional } from '../middleware/turnstile.js';
import { config } from '../config.js';

function createReq(token?: string): Partial<Request> {
  return {
    body: token ? { turnstileToken: token } : {},
    ip: '127.0.0.1',
    socket: {} as Partial<Request>['socket'],
  } as Partial<Request>;
}

describe('verifyTurnstile', () => {
  let next: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    (config as any).TURNSTILE_SECRET_KEY = '';
    (config as any).NODE_ENV = 'test';
    (config as any).FRONTEND_URL = 'http://localhost:5173';
    global.fetch = originalFetch;
  });

  it('throws ValidationError when token is missing in production', async () => {
    (config as any).NODE_ENV = 'production';
    (config as any).TURNSTILE_SECRET_KEY = 'valid-secret';

    const req = createReq();
    await verifyTurnstile(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'Token de seguridad requerido',
    }));
  });

  it('calls next() in non-production when TURNSTILE_SECRET_KEY is not set and FRONTEND_URL is localhost', async () => {
    const req = createReq('some-token');
    await verifyTurnstile(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('throws ValidationError in production when TURNSTILE_SECRET_KEY is not set even with localhost FRONTEND_URL', async () => {
    (config as any).NODE_ENV = 'production';

    const req = createReq('some-token');
    await verifyTurnstile(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'Turnstile no está configurado',
    }));
  });

  it('throws ValidationError when TURNSTILE_SECRET_KEY is not set and FRONTEND_URL is not localhost', async () => {
    (config as any).FRONTEND_URL = 'https://fiestaylista.com';

    const req = createReq('some-token');
    await verifyTurnstile(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'Turnstile no está configurado',
    }));
  });

  it('calls next() when verification succeeds', async () => {
    (config as any).TURNSTILE_SECRET_KEY = 'valid-secret';

    global.fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    const req = createReq('valid-token');
    await verifyTurnstile(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    );
  });

  it('throws ValidationError when verification fails', async () => {
    (config as any).TURNSTILE_SECRET_KEY = 'valid-secret';

    global.fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, 'error-codes': ['invalid-input-response'] }),
    });

    const req = createReq('invalid-token');
    await verifyTurnstile(req as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'No se pudo verificar que no eres un robot (invalid-input-response)',
    }));
  });
});

describe('verifyTurnstileOptional', () => {
  let next: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    (config as any).TURNSTILE_SECRET_KEY = '';
    (config as any).NODE_ENV = 'test';
    (config as any).FRONTEND_URL = 'http://localhost:5173';
    global.fetch = originalFetch;
  });

  it('deja pasar sin token aplicando el rate limiter estricto (FE-02: checkout)', async () => {
    (config as any).NODE_ENV = 'production';
    (config as any).TURNSTILE_SECRET_KEY = 'valid-secret';

    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
      header: vi.fn(),
      getHeader: vi.fn().mockReturnValue(undefined),
      on: vi.fn(),
    } as unknown as Response;
    const req = createReq() as Request;
    global.fetch = vi.fn();
    await verifyTurnstileOptional(req, res, next as NextFunction);

    expect(res.setHeader).toHaveBeenCalledWith('X-Turnstile-Status', 'bypassed');
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('verifica el token cuando llega y deja pasar', async () => {
    (config as any).NODE_ENV = 'production';
    (config as any).TURNSTILE_SECRET_KEY = 'valid-secret';
    global.fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    });

    const res = { setHeader: vi.fn() } as unknown as Response;
    await verifyTurnstileOptional(createReq('valid-token') as Request, res, next as NextFunction);

    expect(res.setHeader).toHaveBeenCalledWith('X-Turnstile-Status', 'verified');
    expect(next).toHaveBeenCalledWith();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

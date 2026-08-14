import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('express-rate-limit', () => ({
  default: vi.fn(),
}));

// El config real hace process.exit(1) en CI si falta DATABASE_URL — se mockea
// con solo los campos que usa el middleware de rate limit.
vi.mock('../config.js', () => ({
  config: {
    API_RATE_LIMIT: 100,
    PAYMENT_RATE_LIMIT: 10,
    WEBHOOK_RATE_LIMIT: 600,
  },
}));

vi.mock('../middleware/rateLimitStore.js', () => ({
  PostgresStore: vi.fn(),
}));

import rateLimit from 'express-rate-limit';
import { createLimiter, authKeyGenerator, strictKeyGenerator } from '../middleware/rateLimit.js';

function optsFor(prefix: string): { windowMs: number; max: number } | undefined {
  const call = vi.mocked(rateLimit).mock.calls.find((c) => {
    const opts = c[0] as { keyGenerator: (req: unknown) => string };
    return opts.keyGenerator({ socket: {} }).startsWith(prefix);
  });
  return call?.[0] as { windowMs: number; max: number } | undefined;
}

describe('createLimiter', () => {
  it('usa ventana de 60s por defecto (resto de limiters no afectados)', () => {
    createLimiter({ prefix: 'custom-default', max: 1, message: 'm' });
    expect(optsFor('custom-default')?.windowMs).toBe(60_000);
  });

  it('propaga windowMs custom al store', () => {
    createLimiter({ prefix: 'custom-ms', max: 1, message: 'm', windowMs: 900_000 });
    expect(optsFor('custom-ms')?.windowMs).toBe(900_000);
  });

  it('F6: authLimiter usa ventana de 15 min (alineada con lockout.ts)', () => {
    expect(optsFor('auth')?.windowMs).toBe(15 * 60 * 1000);
    expect(optsFor('auth')?.max).toBe(10);
  });

  it('F6: resetLimiter usa ventana de 15 min', () => {
    expect(optsFor('reset')?.windowMs).toBe(15 * 60 * 1000);
    expect(optsFor('reset')?.max).toBe(5);
  });

  it('F6: strictFallbackLimiter usa ventana de 15 min', () => {
    expect(optsFor('strict')?.windowMs).toBe(15 * 60 * 1000);
    expect(optsFor('strict')?.max).toBe(5);
  });

  it('D2-A3: usa passOnStoreError: true (fail-open real ante fallo del store)', () => {
    const call = vi.mocked(rateLimit).mock.calls.find((c) => (c[0] as { passOnStoreError?: boolean }).passOnStoreError === true);
    expect(call, 'ningún limiter usa passOnStoreError').toBeDefined();
  });

  it('E2: authKeyGenerator usa clave compuesta email+IP (egress compartido de Netlify)', () => {
    const req = { body: { email: 'Usuario@Example.COM ' }, ip: '203.0.113.7' };
    const key = authKeyGenerator(req as never);
    expect(key.startsWith('email:')).toBe(true);
    expect(key).toContain('203.0.113.7');
    // Normaliza email (trim + lowercase) para no crear keys polimórficas
    const req2 = { body: { email: 'usuario@example.com' }, ip: '203.0.113.7' };
    expect(authKeyGenerator(req2 as never)).toBe(key);
  });

  it('E2: authKeyGenerator sin email usa ip (fallback para endpoints sin body)', () => {
    expect(authKeyGenerator({ socket: { remoteAddress: '198.51.100.9' } } as never)).toBe('ip:198.51.100.9');
  });

  it('E2: strictKeyGenerator también compone email+IP con prefijo turnstile-fallback', () => {
    const key = strictKeyGenerator({ body: { email: 'a@b.co' }, ip: '203.0.113.7' } as never);
    expect(key.startsWith('turnstile-fallback:email:')).toBe(true);
    expect(strictKeyGenerator({ socket: { remoteAddress: '198.51.100.9' } } as never)).toBe('turnstile-fallback:ip:198.51.100.9');
  });
});

describe('D2-A2 - apiLimiter sin duplicación a nivel de ruta', () => {
  it('ninguna ruta monta apiLimiter local (el global de app.use("/api") ya cubre)', () => {
    const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../routes');
    const files = ['photos.ts', 'gifts.ts', 'subscriptions.ts', 'auth.ts'];
    for (const f of files) {
      const src = fs.readFileSync(path.join(routesDir, f), 'utf8');
      const withLimiter = src.split('\n').filter((l) => l.includes('router.') && l.includes('apiLimiter'));
      expect(withLimiter, `${f} todavía monta apiLimiter local`).toEqual([]);
    }
  });
});

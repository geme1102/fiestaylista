import { describe, it, expect, vi } from 'vitest';

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
import { createLimiter } from '../middleware/rateLimit.js';

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
});

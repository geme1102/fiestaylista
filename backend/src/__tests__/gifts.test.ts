import { describe, it, expect, vi } from 'vitest';

// Mock de dependencias de routes/gifts para poder importar los schemas reales
vi.mock('../config.js', () => ({ config: { JWT_SECRET: 'test' } }));
vi.mock('../db/index.js', () => ({ db: {}, sql: {} }));
vi.mock('../db/schema.js', () => ({ events: {} }));
vi.mock('../services/notifications.js', () => ({
  emitGiftClaimed: vi.fn(),
  subscribeClient: vi.fn(),
  unsubscribeClient: vi.fn(),
  getClientCount: vi.fn(() => 0),
  startSSEScavenger: vi.fn(),
  stopSSEScavenger: vi.fn(),
}));
vi.mock('../services/gift.js', () => ({}));
vi.mock('../middleware/rateLimit.js', () => ({
  giftLimiter: vi.fn((_req, _res, next) => next()),
  contributeLimiter: vi.fn((_req, _res, next) => next()),
  apiLimiter: vi.fn((_req, _res, next) => next()),
}));
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((_req, _res, next) => next()),
  requireAnyAuth: vi.fn((_req, _res, next) => next()),
}));
vi.mock('../middleware/ownership.js', () => ({
  requireEventOwnership: vi.fn((_req, _res, next) => next()),
}));
vi.mock('../middleware/subscription.js', () => ({
  checkGiftLimit: vi.fn(),
}));
vi.mock('../middleware/turnstile.js', () => ({
  verifyTurnstileOptional: vi.fn((_req, _res, next) => next()),
}));
vi.mock('../middleware/validateUuid.js', () => ({
  validateUuidParam: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../utils/asyncHandler.js', () => ({
  asyncHandler: (fn: unknown) => fn as any,
  asyncHandlerWithValidation: (fn: unknown) => fn as any,
}));
vi.mock('../utils/errors.js', () => ({}));
vi.mock('../types/index.js', () => ({}));

import { createGiftSchema, updateGiftSchema } from '../routes/gifts.js';

describe('Gifts - Create Validation', () => {
  it('accepts valid gift name', () => {
    const result = createGiftSchema.parse({ name: 'Pañales talla 1' });
    expect(result.name).toBe('Pañales talla 1');
  });

  it('rejects empty name', () => {
    expect(() => createGiftSchema.parse({ name: '' })).toThrow();
  });

  it('rejects name exceeding 200 chars', () => {
    expect(() => createGiftSchema.parse({ name: 'x'.repeat(201) })).toThrow();
  });
});

describe('Gifts - Update Validation', () => {
  it('accepts claim update', () => {
    const result = updateGiftSchema.parse({
      isClaimed: true,
      claimedBy: 'Juan Pérez',
    });
    expect(result.isClaimed).toBe(true);
    expect(result.claimedBy).toBe('Juan Pérez');
  });

  it('accepts release update', () => {
    const result = updateGiftSchema.parse({
      isClaimed: false,
      claimedBy: null,
    });
    expect(result.isClaimed).toBe(false);
    expect(result.claimedBy).toBeNull();
  });

  it('accepts empty update', () => {
    const result = updateGiftSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

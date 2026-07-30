import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    MERCADO_PAGO_ACCESS_TOKEN: '',
    MERCADO_PAGO_WEBHOOK_SECRET: '',
    RESEND_API_KEY: '',
    FROM_EMAIL: 'test@test.com',
    PORT: 3001,
    PRO_MONTHLY_PRICE_CENTS: 59900,
    PRO_YEARLY_PRICE_CENTS: 660000,
    PRO_PLUS_MONTHLY_PRICE_CENTS: 99900,
    PRO_MONTHLY_CHECKOUT_URL: 'https://mpago.test/pro-monthly',
    PRO_YEARLY_CHECKOUT_URL: 'https://mpago.test/pro-yearly',
    PRO_PLUS_MONTHLY_CHECKOUT_URL: 'https://mpago.test/pro-plus',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
    SENTRY_DSN: '',
    ALLOWED_ORIGINS: [],
  },
}));

function queryBuilder(initialResult: any = []) {
  const qb: any = Promise.resolve(initialResult);
  qb.select = vi.fn(() => qb);
  qb.from = vi.fn(() => qb);
  qb.where = vi.fn(() => qb);
  qb.limit = vi.fn(() => qb);
  qb.offset = vi.fn(() => qb);
  qb.orderBy = vi.fn(() => qb);
  qb.set = vi.fn(() => qb);
  qb.values = vi.fn(() => qb);
  qb.returning = vi.fn().mockResolvedValue([{ id: 'new-id', createdAt: new Date() }]);
  qb.execute = vi.fn().mockResolvedValue(undefined);
  qb.insert = vi.fn(() => qb);
  qb.update = vi.fn(() => qb);
  qb.delete = vi.fn(() => qb);
  qb.onConflictDoNothing = vi.fn(() => qb);
  qb.onConflictDoUpdate = vi.fn(() => qb);
  qb.for = vi.fn(() => qb);
  return qb;
}

function queryBuilderOneRow() {
  const qb = queryBuilder([mockEventData]);
  return qb;
}

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => queryBuilderOneRow()),
    insert: vi.fn(() => queryBuilder()),
    update: vi.fn(() => queryBuilder()),
    delete: vi.fn(() => queryBuilder()),
    transaction: vi.fn((cb: Function) => {
      const tx = queryBuilderOneRow();
      return cb(tx);
    }),
    execute: vi.fn().mockResolvedValue(undefined),
  },
  sql: vi.fn(() => {
    const rows: any[] = [{
      id: 'user-1', email: 'test@test.com', password_hash: '$2a$12$dummyhashfortestingpassword', name: 'Test', tier: 'free', email_verified: true, created_at: new Date(),
      onboarding_completed: false, welcome_tutorial_completed: false,
      user_id: 'user-1', token_hash: 'hash', expires_at: new Date(), revoked: false,
    }];
    return Object.assign(Promise.resolve(rows), rows);
  }),
  isNull: vi.fn((col: any) => col),
  eq: vi.fn((a: any, b: any) => ({ a, b })),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  desc: vi.fn((col: any) => col),
  inArray: vi.fn((col: any, vals: any[]) => ({ col, vals })),
}));

vi.mock('../db/schema.js', () => ({
  events: {},
  users: {},
  gifts: {},
  giftClaims: {},
  photos: {},
  subscriptions: {},
  refreshTokens: {},
  cashFunds: {},
  cashContributions: {},
      proPayments: {},
  failedWebhooks: {},
  platformFees: {},
  messages: {},
  guests: {},
  emailTracking: {},
  eventViews: {},
  consentRecords: {},
  auditLogs: {},
  arcoRequests: {},
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return _res.status(401).json({ error: 'Token de acceso requerido' });
    }
    req.user = { userId: 'user-1', email: 'test@test.com' };
    next();
  },
  requireAnyAuth: (req: any, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return _res.status(401).json({ error: 'Token de acceso requerido' });
    }
    req.user = { userId: 'user-1', email: 'test@test.com' };
    next();
  },
  optionalAuth: (req: any, _res: Response, next: NextFunction) => {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      req.user = { userId: 'user-1', email: 'test@test.com' };
    }
    next();
  },
  requireEmailVerified: (_req: any, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit.js', () => {
  const noop = (_req: Request, _res: Response, next: NextFunction) => next();
  return {
    authLimiter: noop,
    refreshLimiter: noop,
    resetLimiter: noop,
    apiLimiter: noop,
    webhookLimiter: noop,
    viewLimiter: noop,
    paymentLimiter: noop,
    contributeLimiter: noop,
    cancelLimiter: noop,
    uploadLimiter: noop,
    guestUploadLimiter: noop,
    publicStatsLimiter: noop,
    arcoLimiter: noop,
    giftLimiter: noop,
    rsvpLimiter: noop,
    createEventLimiter: noop,
    messageLimiter: noop,
  };
});

vi.mock('../middleware/requestLogger.js', () => ({
  requestLogger: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/cloudflare.js', () => ({
  cloudflareIP: (req: any, _res: Response, next: NextFunction) => {
    try {
      Object.defineProperty(req, 'ip', {
        value: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1',
        configurable: true,
      });
    } catch {
      // ip property might be read-only in some Node versions
    }
    next();
  },
}));

vi.mock('../middleware/ownership.js', () => ({
  requireEventOwnership: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireCashFundOwnership: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/subscription.js', () => ({
  checkEventLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkActiveEventLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  requireActiveSubscription: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  requireTier: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkGiftLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/turnstile.js', () => ({
  verifyTurnstile: (_req: Request, _res: Response, next: NextFunction) => next(),
  verifyTurnstileOptional: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/validateUuid.js', () => ({
  validateUuidParam: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const mockAuthService = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  refreshToken: vi.fn(),
  getUser: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  revokeAllUserTokens: vi.fn(),
  hashToken: vi.fn(),
}));

vi.mock('../services/auth.js', () => mockAuthService);

const mockEventService = vi.hoisted(() => ({
  createEvent: vi.fn(),
  getUserEvents: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  getEventBySlug: vi.fn(),
  completeEvent: vi.fn(),
  reactivateEvent: vi.fn(),
}));

vi.mock('../services/event.js', () => mockEventService);
vi.mock('../services/event-queries.js', () => mockEventService);

const mockGiftService = vi.hoisted(() => ({
  addGift: vi.fn(),
  getEventGifts: vi.fn(),
  updateGift: vi.fn(),
  deleteGift: vi.fn(),
  claimGift: vi.fn(),
  releaseGift: vi.fn(),
  addGroupClaim: vi.fn(),
  getGiftClaims: vi.fn(),
  toggleGroupGift: vi.fn(),
}));

vi.mock('../services/gift.js', () => mockGiftService);

const mockPhotoService = vi.hoisted(() => ({
  getEventPhotos: vi.fn(),
  addPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  toggleFeaturedPhoto: vi.fn(),
  addGuestPhoto: vi.fn(),
  guestUpload: vi.fn(),
}));

vi.mock('../services/photo.js', () => mockPhotoService);

const mockCashFundService = vi.hoisted(() => ({
  getCashFund: vi.fn(),
  createOrUpdateCashFund: vi.fn(),
  createPromise: vi.fn(),
  getContributions: vi.fn(),
  getPromisedAmount: vi.fn(),
}));

vi.mock('../services/cashFund.js', () => mockCashFundService);

const mockMercadopagoService = vi.hoisted(() => ({
  cancelPreapproval: vi.fn(),
  searchPreapprovalsByRef: vi.fn(),
}));

vi.mock('../services/mercadopago.js', () => mockMercadopagoService);

const mockSubscriptionService = vi.hoisted(() => ({
  getCurrentSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  createOrUpdateSubscription: vi.fn(),
  reconcileSubscriptionOnLogin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/subscription.js', () => mockSubscriptionService);

const mockMpWebhooks = vi.hoisted(() => ({
  handlePaymentNotification: vi.fn(),
  handleSubscriptionNotification: vi.fn(),
  handleProPayment: vi.fn(),
}));

vi.mock('../services/mp-webhooks.js', () => mockMpWebhooks);

const mockArcoService = vi.hoisted(() => ({
  getUserData: vi.fn(),
  deleteUserAccount: vi.fn(),
  createArcoRequest: vi.fn(),
  getArcoRequests: vi.fn(),
}));

vi.mock('../services/arco.js', () => mockArcoService);

const mockEventData = vi.hoisted(() => ({ id: 'evt-1', userId: 'user-1', title: 'Test Event', eventType: 'BABY_SHOWER', slug: 'test-event', isActive: true, status: 'active', boostedUntil: null, viewCount: 0, createdAt: new Date(), updatedAt: new Date(), emailVerified: true }));

const mockNotifications = vi.hoisted(() => ({
  emitGiftClaimed: vi.fn(),
  emitPhotoUploaded: vi.fn(),
  emitMessagePosted: vi.fn(),
  subscribeClient: vi.fn(),
  unsubscribeClient: vi.fn(),
  getClientCount: vi.fn(),
  startSSEScavenger: vi.fn(),
}));

vi.mock('../services/notifications.js', () => mockNotifications);

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn().mockResolvedValue('hash'), genSalt: vi.fn().mockResolvedValue('salt') },
  compare: vi.fn().mockResolvedValue(true),
  hash: vi.fn().mockResolvedValue('hash'),
  genSalt: vi.fn().mockResolvedValue('salt'),
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() },
}));

import { config } from '../config.js';
import { createApp } from '../app.js';

const app = createApp();

beforeAll(() => {
  vi.clearAllMocks();
});

describe('Health', () => {
  it('GET /api/health returns ok (liveness)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/ready returns service status (readiness)', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(['healthy', 'degraded']).toContain(res.body.status);
    expect(res.body.checks).toBeDefined();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/auth/register - success', async () => {
    mockAuthService.register.mockResolvedValue({
      user: { id: 'u1', email: 'test@test.com', name: 'Test' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'Password1', name: 'Test' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@test.com');
  });

  it('POST /api/auth/register - validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'invalid', password: 'short', name: '' });

    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login - success', async () => {
    mockAuthService.login.mockResolvedValue({
      user: { id: 'u1', email: 'test@test.com', name: 'Test' },
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('at');
  });

  it('POST /api/auth/refresh - success', async () => {
    mockAuthService.refreshToken.mockResolvedValue({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('x-refresh-request', 'true')
      .set('Cookie', 'refreshToken=some-rt');

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new-at');
  });

  it('POST /api/auth/refresh - no cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('x-refresh-request', 'true');

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - success', async () => {
    mockAuthService.getUser.mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@test.com');
  });

  it('GET /api/auth/me - no auth', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/verify-email - success', async () => {
    mockAuthService.verifyEmail.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/forgot-password - success', async () => {
    mockAuthService.forgotPassword.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/reset-password - success', async () => {
    mockAuthService.resetPassword.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid', password: 'NewPass1' });

    expect(res.status).toBe(200);
  });

  it('POST /api/auth/logout - success with token', async () => {
    mockAuthService.revokeAllUserTokens.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockAuthService.revokeAllUserTokens).toHaveBeenCalled();
  });

  it('POST /api/auth/logout - works without token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockAuthService.revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it('POST /api/auth/resend-verification - success', async () => {
    mockAuthService.resendVerificationEmail.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
  });

  it('GET /api/auth/verify-email - redirects on success', async () => {
    mockAuthService.verifyEmail.mockResolvedValue({});

    const res = await request(app).get('/api/auth/verify-email?token=valid');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('status=success');
  });

  it('GET /api/auth/verify-email - redirects on invalid token', async () => {
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('status=error');
  });
});

describe('Event Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/events - list events', async () => {
    mockEventService.getUserEvents.mockResolvedValue([{ id: 'evt-1', title: 'Test' }]);

    const res = await request(app).get('/api/events').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
  });

  it('POST /api/events - create event', async () => {
    mockEventService.createEvent.mockResolvedValue({ id: 'evt-1', title: 'Birthday' });

    const res = await request(app)
      .post('/api/events')
      .set(auth)
      .send({ title: 'Birthday', eventType: 'BIRTHDAY' });

    expect(res.status).toBe(201);
    expect(res.body.event.title).toBe('Birthday');
  });

  it('POST /api/events - validation error', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(auth)
      .send({ title: '', eventType: 'INVALID' });

    expect(res.status).toBe(400);
  });

  it('GET /api/events/slug/:slug - public event by slug', async () => {
    mockEventService.getEventBySlug.mockResolvedValue({ id: 'evt-1', title: 'Test' });

    const res = await request(app).get('/api/events/slug/my-event');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('evt-1');
  });

  it('GET /api/events/:id - get event', async () => {
    mockEventService.getEvent.mockResolvedValue({ id: 'evt-1', title: 'Test Event' });

    const res = await request(app).get('/api/events/evt-1').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe('Test Event');
  });

  it('PUT /api/events/:id - update event', async () => {
    mockEventService.updateEvent.mockResolvedValue({ id: 'evt-1', title: 'Updated' });

    const res = await request(app)
      .put('/api/events/evt-1')
      .set(auth)
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe('Updated');
  });

  it('DELETE /api/events/:id - delete event', async () => {
    mockEventService.deleteEvent.mockResolvedValue({ success: true });

    const res = await request(app).delete('/api/events/evt-1').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/events/:id/complete - complete event', async () => {
    mockEventService.completeEvent.mockResolvedValue({ success: true });

    const res = await request(app).post('/api/events/evt-1/complete').set(auth);
    expect(res.status).toBe(200);
  });

  it('POST /api/events/:id/reactivate - reactivate event', async () => {
    mockEventService.reactivateEvent.mockResolvedValue({ id: 'evt-1', title: 'Test' });

    const res = await request(app).post('/api/events/evt-1/reactivate').set(auth);
    expect(res.status).toBe(200);
  });
});

describe('Public Routes', () => {
  it('GET /api/public/stats', async () => {
    const res = await request(app).get('/api/public/stats');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
  });

  it('GET /api/public/events', async () => {
    const res = await request(app).get('/api/public/events');
    expect(res.status).toBe(200);
  });
});

describe('Gift Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/events/:eventId/gifts - list gifts', async () => {
    mockGiftService.getEventGifts.mockResolvedValue([{ id: 'g-1', name: 'Gift', isClaimed: false, category: 'otro', order: 0 }]);

    const res = await request(app).get('/api/events/evt-1/gifts');
    expect(res.status).toBe(200);
    expect(res.body.gifts).toHaveLength(1);
  });

  it('POST /api/events/:eventId/gifts - add gift', async () => {
    mockGiftService.addGift.mockResolvedValue({ id: 'g-1', name: 'New Gift' });

    const res = await request(app)
      .post('/api/events/evt-1/gifts')
      .set(auth)
      .send({ name: 'New Gift' });

    expect(res.status).toBe(201);
    expect(res.body.gift.name).toBe('New Gift');
  });

  it('PUT /api/events/:eventId/gifts/:giftId - update gift', async () => {
    mockGiftService.updateGift.mockResolvedValue({ id: 'g-1', name: 'Updated' });

    const res = await request(app)
      .put('/api/events/evt-1/gifts/g-1')
      .set(auth)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('PUT /api/events/:eventId/gifts/:giftId/claim - claim gift', async () => {
    mockGiftService.claimGift.mockResolvedValue({ id: 'g-1', claimedBy: 'Guest' });

    const res = await request(app)
      .put('/api/events/evt-1/gifts/g-1/claim')
      .send({ claimedBy: 'Guest' });

    expect(res.status).toBe(200);
  });

  it('PUT /api/events/:eventId/gifts/:giftId/claim - validation error', async () => {
    const res = await request(app)
      .put('/api/events/evt-1/gifts/g-1/claim')
      .send({ guestName: '', guestPhone: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('PUT /api/events/:eventId/gifts/:giftId/free - free gift', async () => {
    mockGiftService.releaseGift.mockResolvedValue({ id: 'g-1', isClaimed: false });

    const res = await request(app)
      .put('/api/events/evt-1/gifts/g-1/free')
      .set(auth);

    expect(res.status).toBe(200);
  });

  it('DELETE /api/events/:eventId/gifts/:giftId - delete gift', async () => {
    mockGiftService.deleteGift.mockResolvedValue({ success: true });

    const res = await request(app)
      .delete('/api/events/evt-1/gifts/g-1')
      .set(auth);

    expect(res.status).toBe(200);
  });
});

describe('Photo Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/events/:eventId/photos - list photos', async () => {
    mockPhotoService.getEventPhotos.mockResolvedValue({ photos: [{ id: 'p-1', url: 'https://cdn.test/photo.jpg' }], hasMore: false });

    const res = await request(app).get('/api/events/evt-1/photos');
    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(1);
  });

  it('DELETE /api/events/:eventId/photos/:photoId - delete photo', async () => {
    mockPhotoService.deletePhoto.mockResolvedValue({ success: true });

    const res = await request(app).delete('/api/events/evt-1/photos/p-1').set(auth);
    expect(res.status).toBe(200);
  });

  it('PUT /api/events/:eventId/photos/:photoId/feature - feature photo', async () => {
    mockPhotoService.toggleFeaturedPhoto.mockResolvedValue({ id: 'p-1', isFeatured: true });

    const res = await request(app).put('/api/events/evt-1/photos/p-1/feature').set(auth);
    expect(res.status).toBe(200);
  });
});

describe('Subscription Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/subscriptions/create-checkout - returns static URL for pro monthly', async () => {
    const res = await request(app)
      .post('/api/subscriptions/create-checkout')
      .set(auth)
      .send({ tier: 'pro', interval: 'month' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://mpago.test/pro-monthly');
  });

  it('POST /api/subscriptions/create-checkout - returns static URL for pro yearly', async () => {
    const res = await request(app)
      .post('/api/subscriptions/create-checkout')
      .set(auth)
      .send({ tier: 'pro', interval: 'year' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://mpago.test/pro-yearly');
  });

  it('POST /api/subscriptions/create-checkout - returns static URL for pro_plus monthly', async () => {
    const res = await request(app)
      .post('/api/subscriptions/create-checkout')
      .set(auth)
      .send({ tier: 'pro_plus', interval: 'month' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://mpago.test/pro-plus');
  });

  it('POST /api/subscriptions/create-checkout - pro_plus yearly returns error', async () => {
    const res = await request(app)
      .post('/api/subscriptions/create-checkout')
      .set(auth)
      .send({ tier: 'pro_plus', interval: 'year' });

    expect(res.status).toBe(400);
  });

  it('POST /api/subscriptions/create-checkout - validation error for invalid tier', async () => {
    const res = await request(app)
      .post('/api/subscriptions/create-checkout')
      .set(auth)
      .send({ tier: 'invalid', interval: 'month', successUrl: 'http://localhost:5173/success', cancelUrl: 'http://localhost:5173/cancel' });

    expect(res.status).toBe(400);
  });

  it('GET /api/subscriptions/current - get current', async () => {
    mockSubscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro', status: 'active' });

    const res = await request(app).get('/api/subscriptions/current').set(auth);
    expect(res.status).toBe(200);
  });

  it('POST /api/subscriptions/cancel - cancel subscription', async () => {
    mockSubscriptionService.cancelSubscription.mockResolvedValue({ success: true });

    mockSubscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro', status: 'active', mpSubscriptionId: 'mp-1' });
    mockMercadopagoService.cancelPreapproval.mockResolvedValue({});

    const res = await request(app)
      .post('/api/subscriptions/cancel')
      .set(auth)
      .send({ password: 'Password1' });

    expect(res.status).toBe(200);
    expect(mockSubscriptionService.cancelSubscription).toHaveBeenCalledWith('user-1');
  });

  it('POST /api/subscriptions/cancel - cancels locally even when MP cancel fails (DB-first)', async () => {
    mockSubscriptionService.cancelSubscription.mockResolvedValue({ success: true });
    mockSubscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro', status: 'active', mpSubscriptionId: 'mp-1' });
    mockMercadopagoService.cancelPreapproval.mockRejectedValue(new Error('MP API error'));

    const res = await request(app)
      .post('/api/subscriptions/cancel')
      .set(auth)
      .send({ password: 'Password1' });

    expect(res.status).toBe(200);
    expect(mockSubscriptionService.cancelSubscription).toHaveBeenCalledWith('user-1');
    expect(mockMercadopagoService.cancelPreapproval).toHaveBeenCalledWith('mp-1');
  });

  it('POST /api/subscriptions/cancel - cancels locally when no mpSubscriptionId and MP search finds nothing', async () => {
    mockSubscriptionService.cancelSubscription.mockResolvedValue({ success: true });
    mockSubscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro', status: 'active', mpSubscriptionId: null, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    mockMercadopagoService.searchPreapprovalsByRef.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/subscriptions/cancel')
      .set(auth)
      .send({ password: 'Password1' });

    expect(res.status).toBe(200);
    expect(mockMercadopagoService.searchPreapprovalsByRef).toHaveBeenCalled();
    expect(mockMercadopagoService.cancelPreapproval).not.toHaveBeenCalled();
    expect(mockSubscriptionService.cancelSubscription).toHaveBeenCalledWith('user-1');
  });

  it('POST /api/subscriptions/cancel - cancels via MP when no local id but MP search finds preapproval', async () => {
    mockSubscriptionService.cancelSubscription.mockResolvedValue({ success: true });
    mockSubscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro', status: 'active', mpSubscriptionId: null, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    mockMercadopagoService.searchPreapprovalsByRef.mockResolvedValue({ id: 'mp-found-1', status: 'active' });
    mockMercadopagoService.cancelPreapproval.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/subscriptions/cancel')
      .set(auth)
      .send({ password: 'Password1' });

    expect(res.status).toBe(200);
    expect(mockMercadopagoService.searchPreapprovalsByRef).toHaveBeenCalled();
    expect(mockMercadopagoService.cancelPreapproval).toHaveBeenCalledWith('mp-found-1');
    expect(mockSubscriptionService.cancelSubscription).toHaveBeenCalledWith('user-1');
  });

  it('POST /api/subscriptions/sync - sync subscription', async () => {
    mockSubscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro', status: 'active' });

    const res = await request(app).post('/api/subscriptions/sync').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(false);
  });
});

describe('Cash Fund Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PUT /api/events/:eventId/cash-fund - toggle cash fund', async () => {
    mockCashFundService.createOrUpdateCashFund.mockResolvedValue({ collectedAmount: 0, isActive: true });

    const res = await request(app)
      .put('/api/events/evt-1/cash-fund')
      .set(auth)
      .send({ title: 'Fondo', targetAmount: 100000 });

    expect(res.status).toBe(200);
  });

  it('GET /api/events/:eventId/cash-fund - get cash fund', async () => {
    mockCashFundService.getCashFund.mockResolvedValue({ collectedAmount: 100, isActive: true });

    const res = await request(app).get('/api/events/evt-1/cash-fund');
    expect(res.status).toBe(200);
  });
});

describe('Boost Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/events/:eventId/boost - activate cash fund', async () => {
    const res = await request(app)
      .post('/api/events/evt-1/boost')
      .set(auth);

    expect(res.status).toBe(200);
  });

  it('GET /api/events/:eventId/boost-status - get boost status', async () => {
    const res = await request(app).get('/api/events/evt-1/boost-status');
    expect(res.status).toBe(200);
  });
});

describe('Message Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/events/:eventId/messages - list messages', async () => {
    const res = await request(app).get('/api/events/evt-1/messages');
    expect(res.status).toBe(200);
  });

  it('POST /api/events/:eventId/messages - post message', async () => {
    const res = await request(app)
      .post('/api/events/evt-1/messages')
      .send({ authorName: 'Guest', message: 'Great event!' });

    expect(res.status).toBe(201);
  });
});

describe('Guest Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  it('GET /api/events/:eventId/guests - list guests', async () => {
    const res = await request(app).get('/api/events/evt-1/guests').set(auth);
    expect(res.status).toBe(200);
  });

  it('POST /api/events/:eventId/rsvp - submit RSVP', async () => {
    const res = await request(app)
      .post('/api/events/evt-1/rsvp')
      .send({ name: 'Guest', companions: 2 });

    expect(res.status).toBe(201);
  });
});

describe('Analytics Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  it('POST /api/analytics/view - track view', async () => {
    const res = await request(app)
      .post('/api/analytics/view')
      .send({ eventId: 'evt-1', source: 'whatsapp' });

    expect(res.status).toBe(200);
  });

  it('POST /api/analytics/views/batch - batch views (requires pro)', async () => {
    const res = await request(app)
      .post('/api/analytics/views/batch')
      .set(auth)
      .send({ eventIds: ['550e8400-e29b-41d4-a716-446655440000'] });

    expect(res.status).toBe(200);
  });
});

describe('ARCO Routes', () => {
  const auth = { Authorization: 'Bearer token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/auth/arco/my-data - get my data', async () => {
    mockArcoService.getUserData.mockResolvedValue({ data: { email: 'test@test.com' } });

    const res = await request(app).get('/api/auth/arco/my-data').set(auth);
    expect(res.status).toBe(200);
  });

  it('POST /api/auth/arco/request - create ARCO request', async () => {
    mockArcoService.createArcoRequest.mockResolvedValue({ id: 'arco-1', status: 'pending' });

    const res = await request(app)
      .post('/api/auth/arco/request')
      .set(auth)
      .send({ requestType: 'access' });

    expect(res.status).toBe(201);
  });

  it('GET /api/auth/arco/requests - list ARCO requests', async () => {
    mockArcoService.getArcoRequests.mockResolvedValue([{ id: 'arco-1', type: 'access' }]);

    const res = await request(app).get('/api/auth/arco/requests').set(auth);
    expect(res.status).toBe(200);
  });
});

describe('Webhook Routes', () => {
  it('POST /api/webhooks/mercadopago - rejects unsigned requests', async () => {
    mockMpWebhooks.handlePaymentNotification.mockResolvedValue({ received: true });

    const res = await request(app)
      .post('/api/webhooks/mercadopago')
      .send({ type: 'payment', data: { id: 'pay-1' } });

    expect(res.status).toBe(401);
  });

  it('POST /api/webhooks/mercadopago - accepts valid signature and dispatches to handler', async () => {
    const secret = 'test-webhook-secret';
    const original = (config as any).MERCADO_PAGO_WEBHOOK_SECRET;
    (config as any).MERCADO_PAGO_WEBHOOK_SECRET = secret;

    const dataId = 'pay-123';
    const requestId = 'req-456';
    const ts = Math.floor(Date.now() / 1000);
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const hash = createHmac('sha256', secret).update(manifest).digest('hex');
    const signature = `ts=${ts},v1=${hash}`;

    mockMpWebhooks.handlePaymentNotification.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/webhooks/mercadopago')
      .query({ 'data.id': dataId, topic: 'payment' })
      .set('x-signature', signature)
      .set('x-request-id', requestId);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockMpWebhooks.handlePaymentNotification).toHaveBeenCalledWith(dataId);

    (config as any).MERCADO_PAGO_WEBHOOK_SECRET = original;
  });
});

describe('404', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ruta no encontrada');
  });
});

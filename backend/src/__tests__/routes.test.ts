import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-not-for-production',
    JWT_REFRESH_SECRET: 'test-refresh-secret-key',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    MERCADO_PAGO_ACCESS_TOKEN: '',
    MERCADO_PAGO_WEBHOOK_SECRET: '',
    RESEND_API_KEY: '',
    FROM_EMAIL: 'test@test.com',
    PORT: 3001,
    PRO_MONTHLY_PRICE_CENTS: 59900,
    PRO_YEARLY_PRICE_CENTS: 660000,
  },
}));

vi.mock('../db/index.js', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sql: vi.fn(),
}));

vi.mock('../db/schema.js', () => ({
  events: {},
  users: {},
  gifts: {},
  photos: {},
  subscriptions: {},
  refreshTokens: {},
  cashFunds: {},
  cashContributions: {},
  failedWebhooks: {},
  platformFees: {},
  emailTracking: {},
  eventViews: {},
  consentRecords: {},
  auditLogs: {},
  arcoRequests: {},
}));

describe('GET /api/health', () => {
  it('returns health status', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('Error Handler', () => {
  it('returns 500 for unhandled errors', async () => {
    const { errorHandler } = await import('../middleware/error.js');
    const app = express();
    app.get('/error', () => { throw new Error('unexpected'); });
    app.use(errorHandler);

    const res = await request(app).get('/error');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno del servidor');
    expect(res.body.errorId).toBeDefined();
  });

  it('returns 404 for AppError', async () => {
    const { errorHandler } = await import('../middleware/error.js');
    const { NotFoundError } = await import('../utils/errors.js');
    const app = express();
    app.get('/not-found', () => { throw new NotFoundError(); });
    app.use(errorHandler);

    const res = await request(app).get('/not-found');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Recurso no encontrado');
  });

  it('returns custom status code from AppError', async () => {
    const { errorHandler } = await import('../middleware/error.js');
    const { AppError } = await import('../utils/errors.js');
    const app = express();
    app.get('/custom', () => { throw new AppError(429, 'Too fast'); });
    app.use(errorHandler);

    const res = await request(app).get('/custom');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too fast');
  });
});

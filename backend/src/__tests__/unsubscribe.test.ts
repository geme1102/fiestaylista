import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createUnsubscribeToken } from '../utils/unsubscribeToken.js';

vi.mock('../config.js', () => ({
  config: { JWT_SECRET: 'test-secret-32-characters-minimum!!!', FRONTEND_URL: 'https://fiestaylista.com', BACKEND_URL: 'https://api.fiestaylista.com' },
}));

vi.mock('../db/index.js', () => ({
  db: { insert: vi.fn() },
}));

vi.mock('../db/schema.js', () => ({
  emailSuppressions: {},
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../middleware/rateLimit.js', () => ({
  createLimiter: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import unsubscribeRouter from '../routes/unsubscribe.js';

beforeEach(() => {
  vi.resetAllMocks();
});

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use('/', unsubscribeRouter);
  return app;
}

describe('GET /unsubscribe', () => {
  it('muestra el formulario cuando el token es válido', async () => {
    const token = createUnsubscribeToken('user@test.com');
    const res = await request(makeApp()).get(`/unsubscribe?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('form method="POST"');
    expect(res.text).toContain(`/unsubscribe?token=${encodeURIComponent(token)}`);
  });

  it('sin token muestra el prompt de iniciar sesión en el frontend', async () => {
    const res = await request(makeApp()).get('/unsubscribe');

    expect(res.status).toBe(200);
    expect(res.text).toContain('https://fiestaylista.com/login');
  });

  it('con token inválido muestra el prompt de iniciar sesión (no filtra el email)', async () => {
    const res = await request(makeApp()).get('/unsubscribe?token=token-invalido');

    expect(res.status).toBe(200);
    expect(res.text).toContain('https://fiestaylista.com/login');
  });
});

describe('POST /unsubscribe', () => {
  it('inserta la supresión con token válido y responde HTML de confirmación', async () => {
    const { db } = await import('../db/index.js');
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    vi.mocked(db.insert).mockReturnValue({ values } as any);
    const token = createUnsubscribeToken('user@test.com');

    const res = await request(makeApp()).post(`/unsubscribe?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Ya no recibirás correos promocionales');
    expect(values).toHaveBeenCalledWith({ email: 'user@test.com', reason: 'unsubscribe_one_click' });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it('responde 200 con confirmación sin insertar cuando el token es inválido (anti-enumeración)', async () => {
    const { db } = await import('../db/index.js');

    const res = await request(makeApp()).post('/unsubscribe?token=token-invalido');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Ya no recibirás correos promocionales');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('responde 200 con confirmación sin token', async () => {
    const { db } = await import('../db/index.js');

    const res = await request(makeApp()).post('/unsubscribe');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Ya no recibirás correos promocionales');
    expect(db.insert).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { AddressInfo } from 'node:net';

// Guardado en módulo: otros tests sobrescriben global.fetch (Turnstile)
const realFetch = globalThis.fetch;

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    TURNSTILE_SECRET_KEY: '',
    FRONTEND_URL: 'http://localhost:5173',
    CLOUDINARY_CLOUD_NAME: 'demo',
    BACKEND_URL: 'http://localhost:3001',
  },
}));

vi.mock('../middleware/rateLimit.js', () => ({
  guestUploadLimiter: (_req: any, _res: any, next: () => void) => next(),
  uploadLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../db/index.js', () => {
  const events = {
    id: 'events.id',
    isActive: 'events.isActive',
    deletedAt: 'events.deletedAt',
  };
  const users = { tier: 'users.tier' };
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'evt-1', ownerTier: 'pro' }]),
            })),
          })),
        })),
      })),
    },
    events,
    users,
  };
});

vi.mock('cloudinary', async () => {
  const { PassThrough } = await import('node:stream');
  return {
    v2: {
      uploader: {
        upload_stream: vi.fn((_opts: any, cb: (err: Error | null, result: { secure_url: string } | null) => void) => {
          const stream = new PassThrough();
          stream.on('data', () => {});
          setTimeout(() => {
            stream.emit('end');
            cb(null, { secure_url: 'https://res.cloudinary.com/demo/fiestaylista/upload_1.jpg' });
          }, 0);
          return stream;
        }),
        destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
      },
    },
  };
});

vi.mock('multer', () => {
  const single = () => (req: any, _res: any, cb: (err: Error | null) => void) => {
    req.file = { path: '/tmp/fake-upload.jpg', mimetype: 'image/jpeg' };
    req.body = req.body ?? {};
    cb(null);
  };
  const multerMock: any = () => ({ single });
  multerMock.diskStorage = () => ({});
  return { default: multerMock };
});

vi.mock('node:fs', async () => {
  const { PassThrough } = await import('node:stream');
  return {
    createReadStream: () => {
      const stream = new PassThrough();
      stream.end();
      return stream;
    },
  };
});

vi.mock('node:fs/promises', () => ({
  open: async () => ({
    read: async (buf: Buffer) => {
      buf.set([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      return { bytesRead: 12 };
    },
    close: async () => {},
  }),
  unlink: async () => {},
  mkdir: async () => {},
  rename: async () => {},
}));

const { default: uploadRouter } = await import('../routes/upload.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/upload', uploadRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err?.message ?? 'Error interno del servidor', errorId: 'test-id' });
  });
  return app;
}

describe('POST /api/upload/guest-upload', () => {
  let config: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    config = (await import('../config.js')).config;
    config.NODE_ENV = 'test';
    config.TURNSTILE_SECRET_KEY = '';
    config.FRONTEND_URL = 'http://localhost:5173';
  });

  it('bypasses Turnstile in non-production localhost (no secret) and uploads', async () => {
    const res = await request(makeApp())
      .post('/api/upload/guest-upload')
      .send({ eventId: '123e4567-e89b-12d3-a456-426614174000' });
    expect(res.status).toBe(201);
    expect(res.body.url).toContain('res.cloudinary.com');
  });

  it('rejects with 400 when Turnstile token is missing and secret is set', async () => {
    config.TURNSTILE_SECRET_KEY = 'valid-secret';

    const res = await request(makeApp())
      .post('/api/upload/guest-upload')
      .send({ eventId: '123e4567-e89b-12d3-a456-426614174000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Token de seguridad requerido');
  });

  it('verifies a valid Turnstile token sent in x-turnstile-token header', async () => {
    config.TURNSTILE_SECRET_KEY = 'valid-secret';
    global.fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    }) as any;

    const res = await request(makeApp())
      .post('/api/upload/guest-upload')
      .set('x-turnstile-token', 'valid-token')
      .send({ eventId: '123e4567-e89b-12d3-a456-426614174000' });

    expect(res.status).toBe(201);
  });

  it('rejects invalid Turnstile token with 400', async () => {
    config.TURNSTILE_SECRET_KEY = 'valid-secret';
    global.fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as any;

    const res = await request(makeApp())
      .post('/api/upload/guest-upload')
      .set('x-turnstile-token', 'bad-token')
      .send({ eventId: '123e4567-e89b-12d3-a456-426614174000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No se pudo verificar que no eres un robot');
  });

  it('rejects non-UUID eventId with 400 (not 500)', async () => {
    const res = await request(makeApp())
      .post('/api/upload/guest-upload')
      .send({ eventId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ID del evento inválido');
  });

  it('rejects when Turnstile is not configured in production', async () => {
    config.NODE_ENV = 'production';

    const res = await request(makeApp())
      .post('/api/upload/guest-upload')
      .send({ eventId: '123e4567-e89b-12d3-a456-426614174000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Turnstile no está configurado');
  });

  it('A4: aborta el stream y destruye el asset parcial si Cloudinary no responde en 25s', async () => {
    // Solo fake de setTimeout: supertest/superagent son lazy (no inician el
    // request hasta el await) y usan setImmediate/nextTick reales — así que
    // aquí usamos fetch (arranca inmediatamente) y un server real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      // Otros tests de este archivo sobrescriben global.fetch (Turnstile) —
      // restaurar el fetch real para poder hacer la petición HTTP.
      global.fetch = realFetch;
      const { v2: cloudinary } = await import('cloudinary');
      const { PassThrough } = await import('node:stream');
      const uploader = cloudinary.uploader as any;
      let capturedStream: { destroyed: boolean } | null = null;

      uploader.upload_stream.mockImplementation(() => {
        const stream = new PassThrough();
        capturedStream = stream;
        stream.on('data', () => {});
        // nunca llama al callback: Cloudinary "colgado"
        return stream;
      });

      const server = makeApp().listen(0);
      const port = (server.address() as AddressInfo).port;

      const promise = fetch(`http://127.0.0.1:${port}/api/upload/guest-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      await vi.advanceTimersByTimeAsync(60_000);

      const res = await promise;
      const body = (await res.json()) as { error?: string };
      server.close();

      expect(res.status).toBe(500);
      expect(body.error).toContain('timed out after 25s');
      expect(capturedStream).not.toBeNull();
      expect(capturedStream!.destroyed).toBe(true);
      expect(uploader.destroy).toHaveBeenCalledWith(expect.stringContaining('fiestaylista/'));
    } finally {
      vi.useRealTimers();
    }
  });
});

import compression from 'compression';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { apiLimiter, webhookLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/error.js';
import { cloudflareIP } from './middleware/cloudflare.js';
import type { AppRequest } from './types/index.js';
import * as Sentry from '@sentry/node';

const sentryEnabled = !!config.SENTRY_DSN;

import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import giftsRouter from './routes/gifts.js';
import photosRouter from './routes/photos.js';
import subscriptionsRouter from './routes/subscriptions.js';
import webhooksRouter from './routes/webhooks.js';
import uploadRouter from './routes/upload.js';
import analyticsRouter from './routes/analytics.js';
import publicRouter from './routes/public.js';
import cashRouter from './routes/cash.js';
import boostRouter from './routes/boost.js';
import arcoRouter from './routes/arco.js';
import guestsRouter from './routes/guests.js';
import messagesRouter from './routes/messages.js';

export function createApp() {
  if (sentryEnabled) {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.NODE_ENV,
      tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 0,
    });
  }

  const app = express();

  app.use(compression({ threshold: 512, level: 6 }));
  app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : 0);

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as AppRequest).requestId = randomUUID();
    next();
  });

  app.use(cloudflareIP);
  app.use(requestLogger);

  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.FRONTEND_URL,
        'https://fiestaylista.com',
        'https://www.fiestaylista.com',
        ...(config.NODE_ENV === 'production'
          ? [/^https:\/\/[a-zA-Z0-9-]+--fiestaylista\.netlify\.app$/]
          : ['http://localhost:5173']),
      ];
      if (!origin || allowedOrigins.some((a) => (typeof a === 'string' ? a === origin : a.test(origin)))) {
        callback(null, true);
      } else {
        callback(new Error(`Origen no permitido: ${origin}`));
      }
    },
    credentials: true,
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
        scriptSrcAttr: ["'none'"],
        frameSrc: ["'self'", "https://mpago.la", "https://challenges.cloudflare.com"],
        imgSrc: ["'self'", "https:", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        styleSrcElem: ["'self'", "'unsafe-inline'"],
        styleSrcAttr: ["'none'"],
        connectSrc: ["'self'", config.FRONTEND_URL, config.BACKEND_URL, "https://challenges.cloudflare.com"].filter(Boolean),
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'", "https://mpago.la"],
        workerSrc: ["'none'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
    xContentTypeOptions: true,
    xFrameOptions: false,
  }));

  app.use(cookieParser());

  app.use('/api/webhooks', webhookLimiter, webhooksRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api', publicRouter);

  const startTime = Date.now();

  app.get('/api/health', apiLimiter, async (_req, res) => {
    const checks: Record<string, { status: string; latency?: number }> = {};
    let healthy = true;
    const dbStart = Date.now();
    try {
      const { sql } = await import('./db/index.js');
      await sql`SELECT 1`;
      checks.database = { status: 'connected', latency: Date.now() - dbStart };
    } catch {
      checks.database = { status: 'disconnected' };
      healthy = false;
    }
    if (config.MERCADO_PAGO_ACCESS_TOKEN && config.NODE_ENV === 'production') {
      const mpStart = Date.now();
      try {
        const { MercadoPagoConfig } = await import('mercadopago');
        new MercadoPagoConfig({ accessToken: config.MERCADO_PAGO_ACCESS_TOKEN });
        checks.mercadopago = { status: 'connected', latency: Date.now() - mpStart };
      } catch {
        checks.mercadopago = { status: 'error', latency: Date.now() - mpStart };
      }
    } else {
      checks.mercadopago = { status: config.MERCADO_PAGO_ACCESS_TOKEN ? 'skipped' : 'not_configured' };
    }
    const statusCode = healthy ? 200 : 503;
    res.status(statusCode).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0',
      services: {
        sentry: sentryEnabled ? 'configured' : 'not_configured',
        resend: config.RESEND_API_KEY ? 'configured' : 'not_configured',
        cloudinary: config.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not_configured',
      },
      checks,
    });
  });

  app.get('/health', apiLimiter, (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', apiLimiter);

  app.use('/uploads', express.static('uploads', { maxAge: '1y', immutable: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/events/:eventId/gifts', giftsRouter);
  app.use('/api/events/:eventId/photos', photosRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', cashRouter);
  app.use('/api', boostRouter);
  app.use('/api', guestsRouter);
  app.use('/api', messagesRouter);
  app.use('/api/auth/arco', arcoRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }
  app.use(errorHandler);

  return app;
}

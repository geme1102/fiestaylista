import compression from 'compression';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';

import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
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
  app.set('trust proxy', config.NODE_ENV === 'production' ? 2 : 0);

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as AppRequest).requestId = randomUUID();
    next();
  });

  app.use(cloudflareIP);
  app.use(requestLogger);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      config.FRONTEND_URL,
      'https://fiestaylista.com',
      'https://www.fiestaylista.com',
    ].filter(Boolean);
    const isAllowed = origin && (allowedOrigins.includes(origin) ||
      (config.NODE_ENV === 'production' &&
        /^https:\/\/[a-zA-Z0-9-]+--fiestaylista\.netlify\.app$/.test(origin)));
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin!);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Refresh-Request');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

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
        // reportUri: ['/api/csp-violation'],  // Descomentar cuando exista un endpoint collector
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

  app.get('/api/health', apiLimiter, (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health/ready', apiLimiter, async (_req, res) => {
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const checks: Record<string, { status: string; configured?: boolean }> = {};

    const dbStart = Date.now();
    try {
      const { sql } = await import('./db/index.js');
      await sql`SELECT 1`;
      checks.database = { status: 'ok', ...(Date.now() - dbStart > 0 && { latency: Date.now() - dbStart }) };
    } catch {
      checks.database = { status: 'error' };
      overall = 'unhealthy';
    }

    if (config.MERCADO_PAGO_ACCESS_TOKEN) {
      try {
        const { MercadoPagoConfig } = await import('mercadopago');
        new MercadoPagoConfig({ accessToken: config.MERCADO_PAGO_ACCESS_TOKEN });
        checks.mercadopago = { status: 'ok', configured: true };
      } catch {
        checks.mercadopago = { status: 'error', configured: false };
        if (overall !== 'unhealthy') overall = 'degraded';
      }
    } else {
      checks.mercadopago = { status: 'not_configured', configured: false };
      if (overall !== 'unhealthy') overall = 'degraded';
    }

    try {
      cloudinary.config({
        cloud_name: config.CLOUDINARY_CLOUD_NAME || undefined,
        api_key: config.CLOUDINARY_API_KEY || undefined,
        api_secret: config.CLOUDINARY_API_SECRET || undefined,
      });
      const cfg = cloudinary.config();
      if (cfg.cloud_name) {
        checks.cloudinary = { status: 'ok', configured: true };
      } else {
        checks.cloudinary = { status: 'not_configured', configured: false };
        if (overall !== 'unhealthy') overall = 'degraded';
      }
    } catch {
      checks.cloudinary = { status: 'error', configured: false };
      if (overall !== 'unhealthy') overall = 'degraded';
    }

    if (config.RESEND_API_KEY) {
      checks.resend = { status: 'ok', configured: true };
    } else {
      checks.resend = { status: 'not_configured', configured: false };
      if (overall !== 'unhealthy') overall = 'degraded';
    }

    const statusCode = overall === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json({
      status: overall,
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

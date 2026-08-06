import compression from 'compression';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';

import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { apiLimiter, webhookLimiter, createLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/error.js';
import { cloudflareIP } from './middleware/cloudflare.js';
import { isCloudflareIP } from './middleware/cloudflare.js';
import type { AppRequest } from './types/index.js';
import * as Sentry from '@sentry/node';
import { initLoaders, isSentryEnabled, checkDatabase, checkCloudinary, checkMercadoPago, checkResend } from './loaders/index.js';

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
import arcoRouter from './routes/arco.js';
import guestsRouter from './routes/guests.js';
import messagesRouter from './routes/messages.js';
import unsubscribeRouter from './routes/unsubscribe.js';
import resendWebhookRouter from './routes/resendWebhook.js';

export function createApp() {
  // Inicializar servicios externos (Sentry, Cloudinary, etc.)
  initLoaders();

  const app = express();

  app.use(compression({ threshold: 512, level: 6 }));
  // trust proxy: solo confiar saltos provenientes de IPs de Cloudflare.
  // Como el dominio no está proxyado (Cloudflare solo provee Turnstile), el
  // socket en producción es la IP pública directa del cliente: confiar en toda
  // la cadena X-Forwarded-For permitiría spoofear req.ip y anular los
  // rate limiters keyed-by-IP.
  app.set('trust proxy', (ip: string) => isCloudflareIP(ip));

  // HTTP→HTTPS redirect en producción (defense-in-depth; Railway termina TLS)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (config.NODE_ENV === 'production' && req.protocol === 'http' && req.path !== '/health') {
      res.redirect(301, `https://${new URL(config.BACKEND_URL).hostname}${req.originalUrl}`);
      return;
    }
    next();
  });

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as AppRequest).requestId = randomUUID();
    next();
  });

  app.use(cloudflareIP);
  app.use(requestLogger);

  // Healthcheck endpoint sin rate limiter (Railway)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const normalizeUrl = (url: string) => url.replace(/\/+$/, '').toLowerCase();
    const allowedOrigins = [
      config.FRONTEND_URL,
      ...(config.ALLOWED_ORIGINS ?? []),
    ].filter(Boolean);
    const isAllowed = origin && allowedOrigins.some(a => normalizeUrl(a) === normalizeUrl(origin));
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin!);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Refresh-Request');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Access-Control-Expose-Headers', 'RateLimit-Reset, RateLimit-Remaining, Retry-After');
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
        imgSrc: ["'self'", "https://res.cloudinary.com", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcAttr: ["'unsafe-inline'"],
        connectSrc: ["'self'", config.FRONTEND_URL, config.BACKEND_URL, "https://challenges.cloudflare.com"].filter(Boolean),
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'", "https://mpago.la"],
        workerSrc: ["'none'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
        reportUri: ['/api/csp-report'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'sameorigin' },
  }));

  app.use(cookieParser());

  // B5: un solo mount con el limiter — antes había dos `app.use('/api/webhooks',
  // webhookLimiter, ...)`: una petición que no matcheaba el primer router pasaba
  // por webhookLimiter DOS veces (misma instancia singleton) y contaba el doble
  // contra la cuota.
  app.use('/api/webhooks', webhookLimiter, webhooksRouter, resendWebhookRouter);

  app.post('/api/csp-report', createLimiter({ prefix: 'csp', max: 10, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }), express.json({ type: ['application/csp-report', 'application/reports+json'], limit: '64kb' }), (req, res) => {
    const report = req.body?.['csp-report'] ?? req.body;
    if (config.NODE_ENV !== 'test' && report) {
      console.warn('[CSP]', String(report?.['violated-directive'] ?? 'unknown').slice(0, 120), String(report?.['blocked-uri'] ?? '').slice(0, 200));
    }
    res.status(204).end();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/', unsubscribeRouter);

  app.use('/api', apiLimiter);
  app.use('/api', publicRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health/ready', async (_req, res) => {
    // B4: try/catch defensivo — si un check lanza (p.ej. la conexión DB muere a
    // mitad de camino), antes el handler rechazaba sin responder y el healthcheck
    // de Railway se colgaba hasta el timeout del deploy.
    let checks: Record<string, { status: string; configured?: boolean; latency?: number }> | null = null;
    try {
      checks = {
        database: await checkDatabase(),
        mercadopago: checkMercadoPago(),
        cloudinary: checkCloudinary(),
        resend: checkResend(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[HEALTH]', 'Health check lanzó una excepción:', message);
      res.status(503).json({ status: 'unhealthy', checks: { database: { status: 'error' } }, error: message });
      return;
    }

    const overall = checks.database.status === 'error'
      ? 'unhealthy'
      : Object.values(checks).some(c => c.status !== 'ok')
        ? 'degraded'
        : 'healthy';

    const statusCode = overall === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json({ status: overall, checks });
  });

  app.use('/uploads', express.static('uploads', { maxAge: '1y', immutable: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/events/:eventId/gifts', giftsRouter);
  app.use('/api/events/:eventId/photos', photosRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', cashRouter);
  app.use('/api', guestsRouter);
  app.use('/api', messagesRouter);
  app.use('/api/auth/arco', arcoRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', errorId: randomUUID() });
  });

  if (isSentryEnabled()) {
    Sentry.setupExpressErrorHandler(app);
  }
  app.use(errorHandler);

  return app;
}

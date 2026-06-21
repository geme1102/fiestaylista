import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { sql } from './db/index.js';
import type { AppRequest } from './types/index.js';
import { apiLimiter, webhookLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/error.js';
import { cloudflareIP } from './middleware/cloudflare.js';
import * as Sentry from '@sentry/node';
import { logger } from './utils/logger.js';

const sentryEnabled = !!config.SENTRY_DSN;
if (sentryEnabled) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 0,
  });
  logger.info('Sentry inicializado');
}
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
import { startCronJobs, stopCronJobs } from './cron.js';
import { stopSSEScavenger } from './routes/gifts.js';

const app = express();

app.set('trust proxy', 0);

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
        ? [
            /^https:\/\/[a-zA-Z0-9-]+--fiestaylista\.netlify\.app$/,
          ]
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

// Rutas públicas (sin rate limit)
app.use('/api', publicRouter);

const startTime = Date.now();

app.get('/api/health', apiLimiter, async (_req, res) => {
  const checks: Record<string, { status: string; latency?: number }> = {};
  let healthy = true;

  // Database check
  const dbStart = Date.now();
  try {
    await sql`SELECT 1`;
    checks.database = { status: 'connected', latency: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'disconnected' };
    healthy = false;
  }

  // Mercado Pago check (solo en producción si hay token)
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

try {
  await sql`ALTER TABLE photos ADD COLUMN IF NOT EXISTS deleted_at timestamp`;

  await sql`
    CREATE TABLE IF NOT EXISTS "guests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "email" text,
      "phone" text,
      "is_confirmed" boolean NOT NULL DEFAULT false,
      "companions" integer NOT NULL DEFAULT 0,
      "dietary_restrictions" text,
      "message" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "guests_event_id_idx" ON "guests"("event_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "guests_event_id_confirmed_idx" ON "guests"("event_id", "is_confirmed")`;

  await sql`ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_phone" text`;
  await sql`ALTER TABLE "cash_funds" ADD COLUMN IF NOT EXISTS "bank_type" text`;

  await sql`ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "is_group_gift" boolean NOT NULL DEFAULT false`;

  await sql`
    CREATE TABLE IF NOT EXISTS "gift_claims" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "gift_id" uuid NOT NULL REFERENCES "gifts"("id") ON DELETE CASCADE,
      "claimed_by" text NOT NULL,
      "message" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "gift_claims_gift_id_idx" ON "gift_claims"("gift_id")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "author_name" text NOT NULL,
      "message" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "messages_event_id_idx" ON "messages"("event_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at")`;

  await sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false`;
  await sql`CREATE INDEX IF NOT EXISTS "photos_is_featured_idx" ON "photos"("is_featured")`;

  logger.info('Migraciones aplicadas correctamente');
} catch (err) {
  logger.fatal({ err }, 'Error aplicando migraciones');
  process.exit(1);
}

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, environment: config.NODE_ENV, frontend: config.FRONTEND_URL, backend: config.BACKEND_URL }, 'Servidor iniciado');

  startCronJobs();
});

const SHUTDOWN_TIMEOUT = 10_000;

function gracefulShutdown(signal: string) {
  logger.warn({ signal }, 'Cerrando servidor...');
  stopSSEScavenger();
  stopCronJobs();

  server.close(() => {
    sql.end({ timeout: 5 }).then(() => {
      logger.info('Conexiones cerradas correctamente.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error('Timeout de cierre forzado.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Excepción no capturada');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Promesa rechazada no capturada');
  gracefulShutdown('unhandledRejection');
});

export default app;

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
import { startCronJobs, stopCronJobs } from './cron.js';
import { stopSSEScavenger } from './routes/gifts.js';

const app = express();

app.set('trust proxy', 1);

app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as AppRequest).requestId = randomUUID();
  next();
});

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
    if (origin && allowedOrigins.some((a) => (typeof a === 'string' ? a === origin : a.test(origin)))) {
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

// Raw body parser exclusivo para webhooks de MP (antes de express.json())
// Express aplica este middleware solo a /api/webhooks/mercadopago
app.use('/api/webhooks/mercadopago', webhookLimiter, express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/webhooks', webhooksRouter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rutas públicas (sin rate limit)
app.use('/api', publicRouter);

app.get('/api/health', apiLimiter, async (_req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: 'disconnected',
    });
  }
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
app.use('/api/auth/arco', arcoRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  console.log(`\n  🎉 Fiesta y Lista API`);
  console.log(`  ─────────────────────`);
  console.log(`  Ambiente: ${config.NODE_ENV}`);
  console.log(`  Puerto:   ${config.PORT}`);
  console.log(`  URL:      http://localhost:${config.PORT}`);
  console.log(`  Frontend: ${config.FRONTEND_URL}`);
  console.log(`  Backend:  ${config.BACKEND_URL}`);
  console.log(`  MP Notif: ${config.BACKEND_URL}/api/webhooks/mercadopago\n`);

  startCronJobs();
});

const SHUTDOWN_TIMEOUT = 10_000;

function gracefulShutdown(signal: string) {
  console.log(`\n  Recibido ${signal}. Cerrando servidor...`);
  stopSSEScavenger();
  stopCronJobs();

  server.close(() => {
    sql.end({ timeout: 5 }).then(() => {
      console.log('  Conexiones cerradas correctamente.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('  Timeout de cierre forzado.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('[Fatal] Excepción no capturada:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Promesa rechazada no capturada:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;

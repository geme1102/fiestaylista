import { v2 as cloudinary } from 'cloudinary';
import * as Sentry from '@sentry/node';
import { config } from '../config.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Loaders');

// ——————————————————————————————————————————
// Sentry
// ——————————————————————————————————————————
let sentryInitialized = false;

export function initSentry(): void {
  if (!config.SENTRY_DSN) return;
  if (sentryInitialized) return;

  try {
    const scrubKeys = ['payerEmail', 'hostPhone', 'bankPhone', 'contributorName', 'eventLocation', 'email', 'password', 'token', 'secret', 'authorization', 'cookie'];
    const scrub = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        const lower = key.toLowerCase();
        if (scrubKeys.some(k => lower.includes(k))) {
          (obj as Record<string, unknown>)[key] = '[REDACTED]';
        } else {
          scrub((obj as Record<string, unknown>)[key]);
        }
      }
    };

    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.NODE_ENV,
      tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 0,
      beforeSend(event) {
        scrub(event);
        return event;
      },
    });

    sentryInitialized = true;
    log.info('Sentry inicializado correctamente');
  } catch (e) {
    log.error({ err: e }, 'Error inicializando Sentry');
  }
}

export function isSentryEnabled(): boolean {
  return sentryInitialized;
}

// ——————————————————————————————————————————
// Cloudinary
// ——————————————————————————————————————————
export function initCloudinary(): void {
  if (!config.CLOUDINARY_CLOUD_NAME) {
    log.warn('Cloudinary no configurado — subida de imágenes no disponible');
    return;
  }

  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
  });

  log.info('Cloudinary configurado correctamente');
}

// ——————————————————————————————————————————
// Health check helpers (usados por /api/health/ready)
// ——————————————————————————————————————————
export interface ServiceCheck {
  status: string;
  configured?: boolean;
  latency?: number;
}

export async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const { sql } = await import('../db/index.js');
    await sql`SELECT 1`;
    return { status: 'ok', latency: Date.now() - start };
  } catch {
    return { status: 'error' };
  }
}

export function checkCloudinary(): ServiceCheck {
  const cfg = cloudinary.config();
  if (cfg.cloud_name) {
    return { status: 'ok', configured: true };
  }
  return { status: 'not_configured', configured: false };
}

export function checkMercadoPago(): ServiceCheck {
  if (config.MERCADO_PAGO_ACCESS_TOKEN) {
    return { status: 'ok', configured: true };
  }
  return { status: 'not_configured', configured: false };
}

export function checkResend(): ServiceCheck {
  if (config.RESEND_API_KEY) {
    return { status: 'ok', configured: true };
  }
  return { status: 'not_configured', configured: false };
}

// ——————————————————————————————————————————
// Inicialización completa
// ——————————————————————————————————————————
export function initLoaders(): void {
  initSentry();
  initCloudinary();
  log.info('Loaders inicializados');
}

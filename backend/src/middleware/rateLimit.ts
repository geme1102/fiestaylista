import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import type { AuthRequest } from '../types/index.js';
import { config } from '../config.js';
import { PostgresStore } from './rateLimitStore.js';

function msg(text: string) {
  return { error: text, errorId: randomUUID() };
}

function keyGenerator(req: AuthRequest): string {
  const userId = req.user?.userId;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return userId ? `user:${userId}:${ip}` : `ip:${ip}`;
}

function createLimiter(opts: { prefix: string; max: number; message: string; keyGenerator?: (req: AuthRequest) => string }) {
  const baseKeyGenerator = opts.keyGenerator ?? keyGenerator;
  return rateLimit({
    store: new PostgresStore(),
    windowMs: 60 * 1000,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${opts.prefix}:${baseKeyGenerator(req)}`,
    message: msg(opts.message),
  });
}

export const authLimiter = createLimiter({ prefix: 'auth', max: 5, message: 'Demasiados intentos. Intenta de nuevo en un minuto.' });

export const apiLimiter = createLimiter({ prefix: 'api', max: config.API_RATE_LIMIT, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

export const uploadLimiter = createLimiter({ prefix: 'upload', max: 10, message: 'Demasiadas subidas de archivos. Intenta de nuevo en un minuto.' });

export const guestUploadLimiter = createLimiter({ prefix: 'guest-upload', max: 10, message: 'Demasiadas subidas de invitado. Intenta de nuevo en un minuto.' });

export const resetLimiter = createLimiter({ prefix: 'reset', max: 3, message: 'Demasiados intentos. Intenta de nuevo en un minuto.' });

export const giftLimiter = createLimiter({ prefix: 'gift', max: 30, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

export const refreshLimiter = createLimiter({ prefix: 'refresh', max: 10, message: 'Demasiados intentos de refresco. Intenta de nuevo en un minuto.' });

export const contributeLimiter = createLimiter({ prefix: 'contribute', max: 10, message: 'Demasiadas contribuciones. Intenta de nuevo en un minuto.' });

export const arcoLimiter = createLimiter({ prefix: 'arco', max: 5, message: 'Demasiadas solicitudes ARCO. Intenta de nuevo en un minuto.' });

export const messageLimiter = createLimiter({ prefix: 'message', max: 10, message: 'Demasiados mensajes. Intenta de nuevo en un minuto.' });

export const paymentLimiter = createLimiter({ prefix: 'payment', max: config.PAYMENT_RATE_LIMIT, message: 'Demasiados intentos de pago. Intenta de nuevo en un minuto.' });

export const cancelLimiter = createLimiter({ prefix: 'cancel', max: 5, message: 'Demasiados intentos de cancelación. Intenta de nuevo en un minuto.' });

export const viewLimiter = createLimiter({ prefix: 'view', max: 10, message: 'Demasiadas visitas. Intenta de nuevo en un minuto.' });

export const webhookLimiter = createLimiter({ prefix: 'webhook', max: config.WEBHOOK_RATE_LIMIT, message: 'Demasiadas solicitudes de webhook' });

export const publicStatsLimiter = createLimiter({ prefix: 'public-stats', max: 10, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

export const phoneRevealLimiter = createLimiter({ prefix: 'phone-reveal', max: 5, message: 'Demasiadas solicitudes del teléfono. Intenta de nuevo en un minuto.' });

export const rsvpLimiter = createLimiter({ prefix: 'rsvp', max: 5, message: 'Demasiados RSVP. Intenta de nuevo en un minuto.' });

export const createEventLimiter = createLimiter({ prefix: 'create-event', max: 10, message: 'Demasiados eventos creados. Intenta de nuevo en un minuto.' });

const strictKeyGenerator = (req: AuthRequest) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `turnstile-fallback:${ip}`;
};

export const strictFallbackLimiter = createLimiter({ prefix: 'strict', max: 3, keyGenerator: strictKeyGenerator, message: 'Demasiados intentos sin verificación de seguridad. Intenta de nuevo en un minuto.' });

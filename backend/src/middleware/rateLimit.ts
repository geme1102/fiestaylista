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

function createLimiter(opts: { max: number; message: string; keyGenerator?: (req: AuthRequest) => string }) {
  return rateLimit({
    store: new PostgresStore(),
    windowMs: 60 * 1000,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator ?? keyGenerator,
    message: msg(opts.message),
  });
}

export const authLimiter = createLimiter({ max: 5, message: 'Demasiados intentos. Intenta de nuevo en un minuto.' });

export const apiLimiter = createLimiter({ max: config.API_RATE_LIMIT, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

export const uploadLimiter = createLimiter({ max: 10, message: 'Demasiadas subidas de archivos. Intenta de nuevo en un minuto.' });

export const guestUploadLimiter = createLimiter({ max: 10, message: 'Demasiadas subidas de invitado. Intenta de nuevo en un minuto.' });

export const resetLimiter = createLimiter({ max: 3, message: 'Demasiados intentos. Intenta de nuevo en un minuto.' });

export const giftLimiter = createLimiter({ max: 30, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

export const refreshLimiter = createLimiter({ max: 10, message: 'Demasiados intentos de refresco. Intenta de nuevo en un minuto.' });

export const contributeLimiter = createLimiter({ max: 10, message: 'Demasiadas contribuciones. Intenta de nuevo en un minuto.' });

export const arcoLimiter = createLimiter({ max: 5, message: 'Demasiadas solicitudes ARCO. Intenta de nuevo en un minuto.' });

export const messageLimiter = createLimiter({ max: 10, message: 'Demasiados mensajes. Intenta de nuevo en un minuto.' });

export const paymentLimiter = createLimiter({ max: config.PAYMENT_RATE_LIMIT, message: 'Demasiados intentos de pago. Intenta de nuevo en un minuto.' });

export const cancelLimiter = createLimiter({ max: 5, message: 'Demasiados intentos de cancelación. Intenta de nuevo en un minuto.' });

export const viewLimiter = createLimiter({ max: 10, message: 'Demasiadas visitas. Intenta de nuevo en un minuto.' });

export const webhookLimiter = createLimiter({ max: config.WEBHOOK_RATE_LIMIT, message: 'Demasiadas solicitudes de webhook' });

export const publicStatsLimiter = createLimiter({ max: 10, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

export const rsvpLimiter = createLimiter({ max: 5, message: 'Demasiados RSVP. Intenta de nuevo en un minuto.' });

export const createEventLimiter = createLimiter({ max: 10, message: 'Demasiados eventos creados. Intenta de nuevo en un minuto.' });

const strictKeyGenerator = (req: AuthRequest) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `turnstile-fallback:${ip}`;
};

export const strictFallbackLimiter = createLimiter({ max: 3, keyGenerator: strictKeyGenerator, message: 'Demasiados intentos sin verificación de seguridad. Intenta de nuevo en un minuto.' });

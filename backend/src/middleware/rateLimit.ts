import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import type { AuthRequest } from '../types/index.js';
import { config } from '../config.js';

function msg(text: string) {
  return { error: text, errorId: randomUUID() };
}

function keyGenerator(req: AuthRequest): string {
  const userId = req.user?.userId;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return userId ? `user:${userId}:${ip}` : `ip:${ip}`;
}

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados intentos. Intenta de nuevo en un minuto.'),
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.API_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas solicitudes. Intenta de nuevo en un minuto.'),
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas subidas de archivos. Intenta de nuevo en un minuto.'),
});

export const guestUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas subidas de invitado. Intenta de nuevo en un minuto.'),
});

export const resetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados intentos. Intenta de nuevo en un minuto.'),
});

export const giftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas solicitudes. Intenta de nuevo en un minuto.'),
});

export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados intentos de refresco. Intenta de nuevo en un minuto.'),
});

export const contributeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas contribuciones. Intenta de nuevo en un minuto.'),
});

export const arcoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas solicitudes ARCO. Intenta de nuevo en un minuto.'),
});

export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados mensajes. Intenta de nuevo en un minuto.'),
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.PAYMENT_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados intentos de pago. Intenta de nuevo en un minuto.'),
});

export const cancelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados intentos de cancelación. Intenta de nuevo en un minuto.'),
});

export const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas visitas. Intenta de nuevo en un minuto.'),
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.WEBHOOK_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas solicitudes de webhook'),
});

export const publicStatsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiadas solicitudes. Intenta de nuevo en un minuto.'),
});

export const rsvpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados RSVP. Intenta de nuevo en un minuto.'),
});

export const createEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: msg('Demasiados eventos creados. Intenta de nuevo en un minuto.'),
});

// Rate limiter ultra-estricto para endpoints que aceptan requests sin token Turnstile.
// Actúa como barrera de seguridad cuando el captcha no se envía (posible bot).
export const strictFallbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return `turnstile-fallback:${ip}`;
  },
  message: msg('Demasiados intentos sin verificación de seguridad. Intenta de nuevo en un minuto.'),
});

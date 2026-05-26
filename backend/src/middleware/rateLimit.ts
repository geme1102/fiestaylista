import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

function keyGenerator(req: Request): string {
  const userId = (req as any).user?.userId;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return userId ? `user:${userId}:${ip}` : `ip:${ip}`;
}

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiados intentos. Intenta de nuevo en un minuto.' },
  skipSuccessfulRequests: true,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiadas subidas de archivos. Intenta de nuevo en un minuto.' },
});

export const giftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});

export const guestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiadas cuentas guest. Intenta de nuevo en un minuto.' },
});

export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiados intentos de refresco. Intenta de nuevo en un minuto.' },
});

export const contributeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiadas contribuciones. Intenta de nuevo en un minuto.' },
});

export const consentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});

export const arcoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Demasiadas solicitudes ARCO. Intenta de nuevo en un minuto.' },
});

import rateLimit from 'express-rate-limit';
import { randomUUID, createHash } from 'node:crypto';
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

function emailFromBody(req: AuthRequest): string | null {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

// E2: el SPA llama /api/* same-origin → el proxy de Netlify reenvía a Railway,
// así que req.ip es la IP egress de Netlify compartida por TODO un PoP.
// Netlify NO publica rangos de IP (posición oficial: fluctuantes, allowlist
// solo con el add-on Enterprise Private Connectivity) → no se puede ampliar
// `trust proxy` con rangos. Clave compuesta email+IP: cada cuenta real del PoP
// tiene su propia cuota (un atacante con 10 fallos YA NO bloquea el login del
// PoP completo). El atacante que rota muchos emails queda cubierto por el
// lockout por email de lockout.ts (15 fallos/30 min) y el throttle IP
// multi-cuenta (isIpThrottled).
export function authKeyGenerator(req: AuthRequest): string {
  const email = emailFromBody(req);
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if (!email) return `ip:${ip}`;
  const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 16);
  return `email:${emailHash}:ip:${ip}`;
}

export function createLimiter(opts: { prefix: string; max: number; message: string; keyGenerator?: (req: AuthRequest) => string; windowMs?: number }) {
  const baseKeyGenerator = opts.keyGenerator ?? keyGenerator;
  return rateLimit({
    store: new PostgresStore(),
    windowMs: opts.windowMs ?? 60 * 1000,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    // D2-A3: si el store lanza (Neon caído, pool saturado), dejar pasar el
    // request en vez de devolver 500 — el rate limiting es defensa, no un
    // punto único de fallo.
    passOnStoreError: true,
    keyGenerator: (req) => `${opts.prefix}:${baseKeyGenerator(req)}`,
    message: msg(opts.message),
  });
}

// F6 (auditoría): los limiters de seguridad usan ventana de 15 min, alineada
// con el lockout de lockout.ts (WINDOW_MINUTES = 15) — antes todos usaban la
// ventana fija de 60s (300 intentos/hora por IP vs umbral de lockout de 20).
const AUTH_WINDOW_MS = 15 * 60 * 1000;

export const authLimiter = createLimiter({ prefix: 'auth', max: 10, windowMs: AUTH_WINDOW_MS, keyGenerator: authKeyGenerator, message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });

export const apiLimiter = createLimiter({ prefix: 'api', max: config.API_RATE_LIMIT, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

export const uploadLimiter = createLimiter({ prefix: 'upload', max: 10, message: 'Demasiadas subidas de archivos. Intenta de nuevo en un minuto.' });

export const guestUploadLimiter = createLimiter({ prefix: 'guest-upload', max: 10, message: 'Demasiadas subidas de invitado. Intenta de nuevo en un minuto.' });

export const resetLimiter = createLimiter({ prefix: 'reset', max: 5, windowMs: AUTH_WINDOW_MS, keyGenerator: authKeyGenerator, message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });

export const giftLimiter = createLimiter({ prefix: 'gift', max: 30, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

// E2: 10→30/min — con egress de Netlify compartido por PoP, 10 refrescos/min
// de toda la red de un PoP colapsaban en falsos 429. Sigue siendo por usuario
// autenticado (keyGenerator con req.user.userId) cuando el token es válido.
export const refreshLimiter = createLimiter({ prefix: 'refresh', max: 30, message: 'Demasiados intentos de refresco. Intenta de nuevo en un minuto.' });

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

export const strictKeyGenerator = (req: AuthRequest) => {
  const email = emailFromBody(req);
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  // E2: clave compuesta email+IP — ver comentario de authKeyGenerator.
  const identity = email ? `email:${createHash('sha256').update(email).digest('hex').slice(0, 16)}:ip:${ip}` : `ip:${ip}`;
  return `turnstile-fallback:${identity}`;
};

export const strictFallbackLimiter = createLimiter({ prefix: 'strict', max: 5, windowMs: AUTH_WINDOW_MS, keyGenerator: strictKeyGenerator, message: 'Demasiados intentos sin verificación de seguridad. Intenta de nuevo en 15 minutos.' });

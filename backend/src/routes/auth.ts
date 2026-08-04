import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { hashToken } from '../services/auth-tokens.js';
import { refreshTokens } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authLimiter, refreshLimiter, resetLimiter, apiLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile, verifyTurnstileOptional } from '../middleware/turnstile.js';
import { config } from '../config.js';
import * as authService from '../services/auth.js';
import { reconcileSubscriptionOnLogin } from '../services/subscription.js';
import { recordConsent } from '../services/consent.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { createModuleLogger } from '../utils/logger.js';
import { sanitizeAndStrip } from '../utils/sanitize.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();
const log = createModuleLogger('AuthRoutes');

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/* FASE 2: Detecta si el request es same-site (vía proxy Netlify) o cross-origin
   (API directa en Railway). Same-site usa SameSite=Lax (no bloqueado por ITP/webviews);
   cross-origin usa SameSite=None (requerido para cookies cross-site con credenciales). */
function resolveSameSite(req: Request): 'lax' | 'none' {
  if (config.NODE_ENV !== 'production') return 'lax';
  const origin = req.headers.origin;
  if (!origin) return 'lax';
  try {
    const isSameSite = origin.replace(/\/+$/, '') === config.FRONTEND_URL.replace(/\/+$/, '');
    return isSameSite ? 'lax' : 'none';
  } catch {
    return 'lax';
  }
}

function setRefreshCookie(req: Request, res: Response, refreshToken: string): void {
  const isProduction = config.NODE_ENV === 'production';
  const sameSite = resolveSameSite(req);
  res.cookie(isProduction ? '__Secure-refreshToken' : 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE,
  });
  res.cookie('hasRefresh', '1', {
    httpOnly: false,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
}

const registerSchema = z.object({
  email: z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().email('Correo electrónico inválido').max(254, 'Email demasiado largo')),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(64, 'La contraseña es demasiado larga')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
  name: z.string().transform(s => sanitizeAndStrip(s.trim())).pipe(z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es demasiado largo')),
});

const loginSchema = z.object({
  email: z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().email('Correo electrónico inválido').max(254, 'Email demasiado largo')),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
});

const forgotPasswordSchema = z.object({
  email: z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().email('Correo electrónico inválido').max(254, 'Email demasiado largo')),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(64, 'La contraseña es demasiado larga')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
});

router.post('/register', authLimiter, verifyTurnstileOptional, asyncHandlerWithValidation(async (req, res) => {
  const { email, password, name } = registerSchema.parse(req.body);
  const result = await authService.register(email, password, name);
  setRefreshCookie(req, res, result.refreshToken);
  const { refreshToken: _, ...safeResult } = result;
  res.status(201).json(safeResult);

  recordConsent({ userId: safeResult.user.id, type: 'privacy', req }).catch((err: unknown) =>
    log.error({ err }, 'Error registrando consentimiento:'),
  );
}));

router.post('/login', authLimiter, verifyTurnstileOptional, asyncHandlerWithValidation(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const result = await authService.login(data.email, data.password, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  setRefreshCookie(req, res, result.refreshToken);
  reconcileSubscriptionOnLogin(result.user.id).catch((err: unknown) =>
    log.error({ err, userId: result.user.id }, 'Error reconciliando suscripción on-login'),
  );
  const { refreshToken: _, ...safeResult } = result;
  res.json(safeResult);
}));

router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
  if (req.headers['x-refresh-request'] !== 'true') {
    log.warn({ method: req.method, path: req.path, origin: req.headers.origin }, 'Refresh sin header x-refresh-request');
    throw new ValidationError('Encabezado de refresco requerido');
  }
  const isProduction = config.NODE_ENV === 'production';
  const cookieName = isProduction ? '__Secure-refreshToken' : 'refreshToken';
  const refreshToken = req.cookies?.[cookieName] ?? null;
  if (!refreshToken) {
    log.warn({ hasCookie: !!req.cookies?.[cookieName], origin: req.headers.origin }, 'Refresh sin token');
    throw new UnauthorizedError('Token de refresco requerido');
  }
  const result = await authService.refreshToken(refreshToken);
  setRefreshCookie(req, res, result.refreshToken);
  const { refreshToken: _, ...safeResult } = result;
  res.json(safeResult);
}));

router.get('/me', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const user = await authService.getUser(req.user!.userId);
  res.json({ user });
}));

router.post('/verify-email', authLimiter, asyncHandlerWithValidation(async (req, res) => {
  const data = verifyEmailSchema.parse(req.body);
  await authService.verifyEmail(data.token);
  res.json({ success: true });
}));

router.get('/verify-email', authLimiter, asyncHandler(async (req, res) => {
  const token = req.query.token as string;
  if (!token || typeof token !== 'string') {
    res.redirect(302, `${config.FRONTEND_URL}/verify-email?status=error&message=${encodeURIComponent('Token inválido')}`);
    return;
  }
  await authService.verifyEmail(token);
  res.redirect(302, `${config.FRONTEND_URL}/verify-email?status=success`);
}));

router.post('/resend-verification', requireAuth, authLimiter, asyncHandler(async (req: AuthRequest, res) => {
  await authService.resendVerificationEmail(req.user!.userId);
  res.json({ success: true });
}));

router.post('/forgot-password', verifyTurnstile, resetLimiter, asyncHandlerWithValidation(async (req, res) => {
  const data = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(data.email);
  res.json({ success: true });
}));

router.post('/reset-password', verifyTurnstile, resetLimiter, asyncHandlerWithValidation(async (req, res) => {
  const data = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(data.token, data.password);
  res.json({ success: true });
}));

router.patch('/onboarding', requireAuth, apiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  await authService.markOnboardingCompleted(req.user!.userId);
  res.json({ success: true });
}));

router.patch('/welcome', requireAuth, apiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  await authService.markWelcomeCompleted(req.user!.userId);
  res.json({ success: true });
}));

router.post('/logout', optionalAuth, apiLimiter, asyncHandler(async (req: AuthRequest, res) => {
  // CSRF defense: exige header custom (los POST cross-site de navegadores no
  // pueden enviarlo sin pasar por CORS preflight, y el allowlist no lo incluye)
  if (req.headers['x-logout-request'] !== 'true') {
    res.status(400).json({ error: 'Header de logout requerido' });
    return;
  }
  const isProduction = config.NODE_ENV === 'production';
  const sameSite = resolveSameSite(req);
  res.clearCookie(isProduction ? '__Secure-refreshToken' : 'refreshToken', {
    path: '/api/auth',
    secure: isProduction,
    sameSite,
  });
  res.clearCookie('hasRefresh', {
    path: '/',
    secure: isProduction,
    sameSite,
  });

  let userId: string | undefined = req.user?.userId;

  // Si el access token expiró (req.user no set), intentar identificar al usuario
  // mediante el refresh token en la cookie
  if (!userId) {
    const cookieName = isProduction ? '__Secure-refreshToken' : 'refreshToken';
    const refreshTokenCookie = req.cookies?.[cookieName] ?? null;
    if (refreshTokenCookie) {
      try {
        const tokenHash = hashToken(refreshTokenCookie);
        const [tokenRecord] = await db
          .select({ userId: refreshTokens.userId })
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, tokenHash))
          .limit(1);
        if (tokenRecord) {
          userId = tokenRecord.userId;
        }
      } catch (err) {
        log.error({ err }, 'Error identificando usuario por refresh token en logout:');
      }
    }
  }

  if (userId) {
    try {
      await authService.revokeAllUserTokens(userId);
    } catch (err) {
      log.error({ err, userId }, 'Error revocando tokens en logout:');
    }
  }

  res.json({ success: true });
}));

export default router;

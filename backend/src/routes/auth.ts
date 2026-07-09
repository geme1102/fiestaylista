import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAnyAuth, optionalAuth } from '../middleware/auth.js';
import { authLimiter, refreshLimiter, resetLimiter, apiLimiter } from '../middleware/rateLimit.js';
import { verifyTurnstile, verifyTurnstileOptional } from '../middleware/turnstile.js';
import { config } from '../config.js';
import * as authService from '../services/auth.js';
import { reconcileSubscriptionOnLogin } from '../services/subscription.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { createModuleLogger } from '../utils/logger.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();
const log = createModuleLogger('AuthRoutes');

function setRefreshCookie(res: Response, refreshToken: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(isProduction ? '__Secure-refreshToken' : 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
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
  name: z.string().transform(s => s.trim()).pipe(z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es demasiado largo')),
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

router.post('/register', authLimiter, verifyTurnstile, asyncHandlerWithValidation(async (req, res) => {
  const { email, password, name } = registerSchema.parse(req.body);
  const result = await authService.register(email, password, name);
  setRefreshCookie(res, result.refreshToken);
  const { refreshToken: _, ...safeResult } = result;
  res.status(201).json(safeResult);
}));

router.post('/login', authLimiter, verifyTurnstileOptional, asyncHandlerWithValidation(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const result = await authService.login(data.email, data.password, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  setRefreshCookie(res, result.refreshToken);
  reconcileSubscriptionOnLogin(result.user.id);
  const { refreshToken: _, ...safeResult } = result;
  res.json(safeResult);
}));

router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
  try {
    if (req.headers['x-refresh-request'] !== 'true') {
      throw new ValidationError('Token de refresco requerido');
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction ? '__Secure-refreshToken' : 'refreshToken';
    const refreshToken = req.cookies?.[cookieName] ?? null;
    if (!refreshToken) {
      log.warn({ hasCookie: !!req.cookies?.[cookieName], origin: req.headers.origin }, 'Refresh sin token');
      throw new UnauthorizedError('Token de refresco requerido');
    }
    const result = await authService.refreshToken(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      throw error;
    }
    log.error({ err: error, method: req.method, path: req.path }, 'Error inesperado en refresh');
    throw error;
  }
}));

router.get('/me', requireAnyAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user?.isGuest) {
    res.json({ user: null, isGuest: true });
    return;
  }
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
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(isProduction ? '__Secure-refreshToken' : 'refreshToken', {
    path: '/api/auth/refresh',
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });

  if (req.user) {
    try {
      await authService.revokeAllUserTokens(req.user.userId);
    } catch (err) {
      log.error({ err, userId: req.user.userId }, 'Error revocando tokens en logout:');
    }
  }

  res.json({ success: true });
}));

export default router;

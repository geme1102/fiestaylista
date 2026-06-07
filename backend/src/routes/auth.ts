import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, refreshLimiter } from '../middleware/rateLimit.js';
import * as authService from '../services/auth.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';
const router = Router();

function setRefreshCookie(res: Response, refreshToken: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const registerSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
});

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const result = await authService.register(email, password, name);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    setRefreshCookie(res, result.refreshToken);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new ValidationError('Token de refresco requerido');
    }
    const result = await authService.refreshToken(refreshToken);
    setRefreshCookie(res, result.refreshToken);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Token de refresco requerido'));
      return;
    }
    next(error);
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await authService.getUser(req.user!.userId);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', authLimiter, async (req, res, next) => {
  try {
    const data = verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(data.token);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.post('/resend-verification', requireAuth, authLimiter, async (req: AuthRequest, res, next) => {
  try {
    await authService.resendVerificationEmail(req.user!.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(data.email);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(data.token, data.password);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map(e => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      // Idealmente revocaríamos el token en DB aquí si hubiera lógica,
      // pero por ahora limpiar la cookie es un avance.
    }
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

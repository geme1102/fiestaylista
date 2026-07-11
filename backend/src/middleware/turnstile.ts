import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { ValidationError } from '../utils/errors.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Turnstile');

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstile(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.body?.turnstileToken;

    if (!config.TURNSTILE_SECRET_KEY) {
      if (config.NODE_ENV !== 'production' && config.FRONTEND_URL?.includes('localhost')) {
        log.warn('Bypass: sin TURNSTILE_SECRET_KEY en entorno no productivo');
        next();
        return;
      }
      throw new ValidationError('Turnstile no está configurado');
    }

    if (!token) {
      throw new ValidationError('Token de seguridad requerido');
    }

    await verifyToken(token, req.ip);
    next();
  } catch (error) {
    next(error);
  }
}

export async function verifyTurnstileOptional(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.body?.turnstileToken;

    if (!config.TURNSTILE_SECRET_KEY) {
      if (config.NODE_ENV !== 'production' && config.FRONTEND_URL?.includes('localhost')) {
        log.warn('Bypass: sin TURNSTILE_SECRET_KEY en entorno no productivo');
        next();
        return;
      }
      throw new ValidationError('Turnstile no está configurado');
    }

    if (!token) {
      log.warn('Token Turnstile ausente — continuando sin verificación (ad-blocker?)');
      next();
      return;
    }

    await verifyToken(token, req.ip);
    next();
  } catch (error) {
    next(error);
  }
}

async function verifyToken(token: string, remoteIp?: string): Promise<void> {
  const formData = new URLSearchParams();
  formData.append('secret', config.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let fetchRes: globalThis.Response;
  try {
    fetchRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await fetchRes.json() as TurnstileResponse;

  if (!data.success) {
    const codes = data['error-codes']?.join(', ') ?? 'desconocido';
    log.warn({ codes }, 'Verificación fallida:');
    throw new ValidationError(`No se pudo verificar que no eres un robot (${codes})`);
  }
}

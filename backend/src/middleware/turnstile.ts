import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { ValidationError } from '../utils/errors.js';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstile(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.body?.turnstileToken;
    if (!token) {
      throw new ValidationError('Token de seguridad requerido');
    }

    if (!config.TURNSTILE_SECRET_KEY) {
      if (config.NODE_ENV === 'production') {
        throw new ValidationError('Turnstile no está configurado');
      }
      next();
      return;
    }

    const formData = new URLSearchParams();
    formData.append('secret', config.TURNSTILE_SECRET_KEY);
    formData.append('response', token);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data: TurnstileResponse = await res.json();

    if (!data.success) {
      console.warn('[Turnstile] Verificación fallida:', data['error-codes']);
      throw new ValidationError('No se pudo verificar que no eres un robot');
    }

    next();
  } catch (error) {
    next(error);
  }
}

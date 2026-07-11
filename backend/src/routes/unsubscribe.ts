import { Router } from 'express';
import type { Request, Response } from 'express';
import { createHmac } from 'node:crypto';
import { db } from '../db/index.js';
import { emailSuppressions } from '../db/schema.js';
import { config } from '../config.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Unsubscribe');
const router = Router();

export function unsubscribeToken(email: string): string {
  return createHmac('sha256', email).update(config.JWT_SECRET).digest('hex').slice(0, 32);
}

router.get('/unsubscribe', (_req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cancelar suscripción — Fiesta y Lista</title></head>
    <body style="font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;text-align:center;padding:24px">
      <h1 style="color:#1f2937;font-size:20px">Cancelar suscripción</h1>
      <p style="color:#6b7280">Para cancelar la recepción de correos promocionales, inicia sesión en tu cuenta de Fiesta y Lista y ve a la sección de notificaciones.</p>
      <p style="margin-top:24px"><a href="/login" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Iniciar sesión</a></p>
    </body>
    </html>
  `);
});

router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    let email: string | null = null;

    // Try query parameter token: /unsubscribe?token=xxx
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    if (token) {
      log.info('One-click unsubscribe via token');
      email = `token:${token}`;
    } else {
      // Try reading email from body (Resend sends the recipient email in payload)
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      email = body?.to || body?.email || null;
      if (!email) {
        log.warn('One-click unsubscribe sin email ni token identificable');
        res.status(400).json({ unsubscribed: false, error: 'No se pudo identificar el email' });
        return;
      }
      log.info({ email }, 'One-click unsubscribe via body email');
    }

    await db
      .insert(emailSuppressions)
      .values({ email, reason: 'unsubscribe_one_click' })
      .onConflictDoNothing();
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code !== '23505') {
      log.error({ err }, 'Error insertando en emailSuppressions:');
    }
  }

  // RFC 8058: always return 200 even if already suppressed (idempotent)
  res.status(200).json({ unsubscribed: true });
});

export default router;

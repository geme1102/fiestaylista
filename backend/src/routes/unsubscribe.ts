import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { emailSuppressions } from '../db/schema.js';
import { config } from '../config.js';
import { createModuleLogger } from '../utils/logger.js';
import { createLimiter } from '../middleware/rateLimit.js';
import { recoverEmailFromToken } from '../utils/unsubscribeToken.js';

const log = createModuleLogger('Unsubscribe');
const router = Router();

const unsubscribeLimiter = createLimiter({ prefix: 'unsubscribe', max: 10, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });

// F7: el HTML se sirve desde el backend (el frontend SPA no tiene /unsubscribe);
// los clientes one-click (List-Unsubscribe-Post) solo esperan un 200 OK.
function confirmationHtml(): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Te has dado de baja — Fiesta y Lista</title></head>
    <body style="font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;text-align:center;padding:24px">
      <h1 style="color:#1f2937;font-size:20px">Ya no recibirás correos promocionales</h1>
      <p style="color:#6b7280">Puedes volver a darte de alta en cualquier momento desde tu cuenta.</p>
      <p style="margin-top:24px"><a href="${config.FRONTEND_URL}" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Ir a Fiesta y Lista</a></p>
    </body>
    </html>
  `;
}

router.get('/unsubscribe', unsubscribeLimiter, (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (token) {
    const email = recoverEmailFromToken(token);
    if (email) {
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cancelar suscripción — Fiesta y Lista</title></head>
        <body style="font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;text-align:center;padding:24px">
          <h1 style="color:#1f2937;font-size:20px">Cancelar suscripción</h1>
          <p style="color:#6b7280">Haz clic en el botón para cancelar tu suscripción a correos promocionales de Fiesta y Lista.</p>
          <form method="POST" action="/unsubscribe?token=${encodeURIComponent(token)}">
            <button type="submit" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600;border:none;cursor:pointer;font-size:16px;margin-top:24px">Cancelar suscripción</button>
          </form>
        </body>
        </html>
      `);
      return;
    }
  }
  // No valid token — show login prompt
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cancelar suscripción — Fiesta y Lista</title></head>
    <body style="font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;text-align:center;padding:24px">
      <h1 style="color:#1f2937;font-size:20px">Cancelar suscripción</h1>
      <p style="color:#6b7280">Para cancelar la recepción de correos promocionales, inicia sesión en tu cuenta de Fiesta y Lista y ve a la sección de notificaciones.</p>
      <p style="margin-top:24px"><a href="${config.FRONTEND_URL}/login" style="display:inline-block;padding:12px 32px;background:#ec4899;color:white;text-decoration:none;border-radius:12px;font-weight:600">Iniciar sesión</a></p>
    </body>
    </html>
  `);
});

router.post('/unsubscribe', unsubscribeLimiter, async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    // Sin token: no se puede identificar el email; responder igual (200) para
    // no filtrar la validez del token (comportamiento anti-enumeración).
    log.warn('One-click unsubscribe sin token');
    res.status(200).send(confirmationHtml());
    return;
  }

  const email = recoverEmailFromToken(token);
  if (!email) {
    log.warn({ token: token.slice(0, 16) + '...' }, 'One-click unsubscribe con token inválido');
    res.status(200).send(confirmationHtml());
    return;
  }

  try {
    await db
      .insert(emailSuppressions)
      .values({ email, reason: 'unsubscribe_one_click' })
      .onConflictDoNothing();
    log.info({ email }, 'Email suprimido via one-click unsubscribe');
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code !== '23505') {
      log.error({ err }, 'Error insertando en emailSuppressions:');
    }
  }

  res.status(200).send(confirmationHtml());
});

export default router;

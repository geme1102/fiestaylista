import { Router } from 'express';
import type { Request, Response } from 'express';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Unsubscribe');
const router = Router();

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

router.post('/unsubscribe', (_req: Request, res: Response) => {
  log.info('One-click unsubscribe POST recibido');
  res.status(200).json({ unsubscribed: true });
});

export default router;

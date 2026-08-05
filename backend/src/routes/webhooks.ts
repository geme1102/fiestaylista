import { Router, type Request, type Response } from 'express';
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';
import * as mpWebhooks from '../services/mp-webhooks.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendError } from '../utils/response.js';
import { db } from '../db/index.js';
import { failedWebhooks } from '../db/schema.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Webhook');

const router = Router();

router.post('/stripe', (_req: Request, res: Response) => {
  sendError(res, 410, 'Stripe ha sido reemplazado por Mercado Pago');
});

function verifyMpSignature(req: Request): boolean {
  const secret = config.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  // Extraer data.id del raw query string (Express/qs parsea data.id como anidado).
  // F3: el formato nuevo de MP envía `?id=...` (con `?type=`) en vez de
  // `?data.id=...` — el valor firmado es el mismo (`id:<valor>` en el manifest).
  let dataId: string | undefined;
  const qIndex = req.url?.indexOf('?');
  if (qIndex !== undefined && qIndex !== -1) {
    const searchParams = new URLSearchParams(req.url!.slice(qIndex + 1));
    dataId = searchParams.get('data.id') || searchParams.get('id') || undefined;
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers['x-signature'] as string | string[] | undefined,
      xRequestId: req.headers['x-request-id'] as string | string[] | undefined,
      dataId,
      secret,
      // No toleranceSeconds — v2.13.0 del SDK tiene un bug donde compara
      // ts (segundos) vs Date.now() (ms) sin convertir, causando siempre
      // TimestampOutOfTolerance. Validamos timestamp manualmente abajo.
    });

    // Validación manual de timestamp (±5 min, ambos sentidos)
    const signature = req.headers['x-signature'] as string | undefined;
    if (signature) {
      const tsPart = signature.split(',').find(p => p.trim().startsWith('ts='));
      if (tsPart) {
        const ts = Number(tsPart.split('=')[1]);
        if (isNaN(ts)) {
          log.warn('Firma con timestamp inválido');
          return false;
        }
        if (Math.abs(Date.now() - ts * 1000) > 5 * 60 * 1000) {
          log.warn('Firma con timestamp fuera de ventana de 5 minutos');
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      log.warn({ reason: err.reason, requestId: err.requestId, timestamp: err.timestamp }, 'Firma MP inválida');
    } else {
      log.error({ err }, 'Error inesperado validando firma MP');
    }
    return false;
  }
}

function extractTopicId(req: Request): { topic?: string; id?: string } {
  // F3: MP envía el tipo de notificación como `topic` O `type` (formato nuevo)
  // según el tipo de suscripción del webhook — antes se ignoraban las
  // notificaciones que solo traían `?type=`.
  const topic = (req.query.topic as string) || (req.query.type as string);
  return {
    topic,
    id: (req.query.id as string) || (req.query['data.id'] as string),
  };
}

router.post('/mercadopago', asyncHandler(async (req: Request, res: Response) => {
  const info = extractTopicId(req);

  if (!verifyMpSignature(req)) {
    log.warn('Firma inválida, ignorando notificación');
    res.status(401).json({ received: false, error: 'Firma inválida' });
    return;
  }

  const topic = info.topic;
  const id = info.id;

  if (!topic || !id) {
    res.status(200).json({ received: true });
    return;
  }

  // Responder 200 inmediato — Mercado Pago espera confirmación rápida
  res.status(200).json({ received: true });

  // Procesar en segundo plano, no bloquear la respuesta
  const processWebhook = async () => {
    try {
      if (topic === 'payment') {
        await mpWebhooks.handlePaymentNotification(id);
      } else if (topic === 'preapproval' || topic === 'subscription' || topic === 'subscription_preapproval') {
        // F3: subscription_preapproval es el topic REAL que MP usa en su
        // integración actual de suscripciones — antes se ignoraba en silencio
        // (ni siquiera entraba a failedWebhooks, el webhook se perdía).
        await mpWebhooks.handleSubscriptionNotification(id);
      } else {
        log.info({ topic, id }, 'Topic de notificación no soportado, ignorando');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error({ error: errorMessage }, 'Error:');

      try {
        await db.insert(failedWebhooks).values({
          topic,
          resourceId: id,
          errorMessage,
          retryCount: 0,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 60 * 1000),
        });
      } catch (dbError) {
        log.error({ err: dbError }, 'Error guardando failed webhook:');
      }
    }
  };

  processWebhook();
}));

export default router;

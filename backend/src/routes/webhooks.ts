import { Router, type Request, type Response } from 'express';
import express from 'express';
import { z } from 'zod';
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';
import * as mpWebhooks from '../services/mp-webhooks.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendError } from '../utils/response.js';
import { db } from '../db/index.js';
import { failedWebhooks } from '../db/schema.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Webhook');

const mpWebhookPayloadSchema = z.object({
  id: z.string().optional(),
  topic: z.string().optional(),
  type: z.string().optional(),
  data: z.object({
    id: z.string().min(1),
  }).optional(),
});

const router = Router();

router.post('/stripe', (_req: Request, res: Response) => {
  sendError(res, 410, 'Stripe ha sido reemplazado por Mercado Pago');
});

function verifyMpSignature(req: Request): boolean {
  const secret = config.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  // Extraer data.id del raw query string (Express/qs parsea data.id como anidado)
  let dataId: string | undefined;
  const qIndex = req.url?.indexOf('?');
  if (qIndex !== undefined && qIndex !== -1) {
    const searchParams = new URLSearchParams(req.url!.slice(qIndex + 1));
    dataId = searchParams.get('data.id') || undefined;
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
        if (!isNaN(ts) && Math.abs(Date.now() - ts * 1000) > 5 * 60 * 1000) {
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
  try {
    const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : '';
    if (!bodyStr) {
      return {
        topic: req.query.topic as string,
        id: req.query.id as string,
      };
    }
    const parsed = mpWebhookPayloadSchema.parse(JSON.parse(bodyStr));
    return {
      topic: parsed.topic || parsed.type,
      id: parsed.data?.id || parsed.id,
    };
  } catch (err) {
    log.error({ err }, 'Error parsing webhook body:');
    return {
      topic: req.query.topic as string,
      id: req.query.id as string,
    };
  }
}

router.post('/mercadopago', express.raw({ type: '*/*', limit: '1mb' }), asyncHandler(async (req: Request, res: Response) => {
  const info = extractTopicId(req);

  if (!verifyMpSignature(req)) {
    log.warn('Firma inválida, ignorando notificación');
    res.status(401).json({ received: false, error: 'Firma inválida' });
    return;
  }

  if (!info.topic || !info.id) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    if (info.topic === 'payment') {
      await mpWebhooks.handlePaymentNotification(info.id);
    } else if (info.topic === 'preapproval' || info.topic === 'subscription') {
      await mpWebhooks.handleSubscriptionNotification(info.id);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ error: errorMessage }, 'Error:');

    try {
      await db.insert(failedWebhooks).values({
        topic: info.topic,
        resourceId: info.id,
        errorMessage,
        retryCount: 0,
        lastAttemptAt: new Date(),
        nextRetryAt: new Date(Date.now() + 60 * 1000),
      });
    } catch (dbError) {
      log.error({ err: dbError }, 'Error guardando failed webhook:');
    }

    res.status(200).json({ received: true });
  }
}));

export default router;

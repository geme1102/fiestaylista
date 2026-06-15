import { Router, type Request, type Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as mpWebhooks from '../services/mp-webhooks.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { db } from '../db/index.js';
import { failedWebhooks } from '../db/schema.js';

const router = Router();

router.post('/stripe', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Stripe ha sido reemplazado por Mercado Pago' });
});

function verifyMpSignature(req: Request): boolean {
  const signature = req.headers['x-signature'] as string;
  if (!signature) return false;

  const webhookSecret = config.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[MP Webhook] MERCADO_PAGO_WEBHOOK_SECRET no configurado');
    return false;
  }

  const parts = signature.split(',');
  let ts = '';
  let hash = '';
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === 'ts') ts = v;
    if (k === 'v1') hash = v;
  }
  if (!ts || !hash) return false;

  const tsNumber = parseInt(ts, 10);
  if (isNaN(tsNumber) || Date.now() - tsNumber > 5 * 60 * 1000) {
    console.warn('[MP Webhook] Firma con timestamp expirado o inválido, ignorando notificación');
    return false;
  }

  // req.body es un Buffer gracias a express.raw() montado en index.ts
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    console.warn('[MP Webhook] Body ausente o no es Buffer');
    return false;
  }

  const bodyStr = req.body.toString('utf-8');

  // Extraer data.id del body para incluirlo en la firma
  let dataId: string | undefined;
  try {
    const parsed = JSON.parse(bodyStr);
    dataId = parsed.data?.id;
  } catch {
    return false;
  }
  if (!dataId) return false;

  // HMAC-SHA256(secret, data.id + '.' + ts + '.' + body)
  const expected = createHmac('sha256', webhookSecret)
    .update(dataId + '.' + ts + '.' + bodyStr)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(hash.toLowerCase()), Buffer.from(expected.toLowerCase()));
  } catch {
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
    const parsed = JSON.parse(bodyStr);
    return {
      topic: parsed.topic || parsed.type,
      id: parsed.id || parsed.data?.id,
    };
  } catch (err) {
    console.error('[MP Webhook] Error parsing webhook body:', err);
    return {
      topic: req.query.topic as string,
      id: req.query.id as string,
    };
  }
}

router.post('/mercadopago', asyncHandler(async (req: Request, res: Response) => {
  const info = extractTopicId(req);

  if (!verifyMpSignature(req)) {
    console.warn('[MP Webhook] Firma inválida, ignorando notificación');
    if (info.topic && info.id) {
      try {
        await db.insert(failedWebhooks).values({
          topic: info.topic,
          resourceId: info.id,
          errorMessage: 'Firma inválida',
          retryCount: 0,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 60 * 1000),
        });
      } catch (dbError) {
        console.error('[MP Webhook] Error guardando failed webhook:', dbError);
      }
    }
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
    console.error('[MP Webhook] Error:', errorMessage);

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
      console.error('[MP Webhook] Error guardando failed webhook:', dbError);
    }

    res.status(200).json({ received: true });
  }
}));

export default router;

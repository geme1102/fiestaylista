import { Router, type Request, type Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
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

  const rawBody = (req as any).rawBody;
  if (!rawBody) return false;

  const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

  const manifest = 'id:' + ts + ';' + bodyStr + ';' + webhookSecret;
  const expected = createHash('sha256').update(manifest).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(hash.toLowerCase()), Buffer.from(expected.toLowerCase()));
  } catch {
    return false;
  }
}

function extractTopicId(req: Request): { topic?: string; id?: string } {
  const rawBody = (req as any).rawBody;
  let result: { topic?: string; id?: string } = {};

  if (typeof rawBody === 'string') {
    try {
      const parsed = JSON.parse(rawBody);
      result = {
        topic: parsed.topic || parsed.type,
        id: parsed.id || parsed.data?.id,
      };
    } catch (err) {
      console.error('[MP Webhook] Error parsing webhook body:', err);
    }
  }

  if (!result.topic) {
    result.topic = req.query.topic as string;
    result.id = req.query.id as string;
  }

  return result;
}

router.post('/mercadopago', asyncHandler(async (req: Request, res: Response) => {
  if (!verifyMpSignature(req)) {
    const { topic, id } = extractTopicId(req);
    console.warn('[MP Webhook] Firma inválida, ignorando notificación');
    if (topic && id) {
      try {
        await db.insert(failedWebhooks).values({
          topic,
          resourceId: id,
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

  const { topic, id } = extractTopicId(req);

  if (!topic || !id) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    if (topic === 'payment') {
      await mpWebhooks.handlePaymentNotification(id);
    } else if (topic === 'preapproval' || topic === 'subscription') {
      await mpWebhooks.handleSubscriptionNotification(id);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MP Webhook] Error:', errorMessage);

    try {
      const { topic: t, id: resId } = extractTopicId(req);
      if (t && resId) {
        await db.insert(failedWebhooks).values({
          topic: t,
          resourceId: resId,
          errorMessage,
          retryCount: 0,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 60 * 1000),
        });
      }
    } catch (dbError) {
      console.error('[MP Webhook] Error guardando failed webhook:', dbError);
    }

    res.status(200).json({ received: true });
  }
}));

export default router;

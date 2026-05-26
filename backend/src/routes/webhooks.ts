import { Router, type Request, type Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import * as mercadopagoService from '../services/mercadopago.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { failedWebhooks } from '../db/schema.js';

const router = Router();

router.post('/stripe', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Stripe ha sido reemplazado por Mercado Pago' });
});

function verifyMpSignature(req: Request): boolean {
  const signature = req.headers['x-signature'] as string;
  if (!signature || !config.MERCADO_PAGO_ACCESS_TOKEN) return false;

  const parts = signature.split(',');
  let ts = '';
  let hash = '';
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === 'ts') ts = v;
    if (k === 'v1') hash = v;
  }
  if (!ts || !hash) return false;

  const rawBody = (req as any).rawBody;
  if (!rawBody) return false;

  let dataId = '';
  try {
    const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    dataId = parsed?.data?.id || parsed?.id || '';
  } catch {
    return false;
  }
  if (!dataId) return false;

  const manifest = ts + config.MERCADO_PAGO_ACCESS_TOKEN + dataId;
  const expected = createHash('sha256').update(manifest).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
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
    } catch {}
  }

  if (!result.topic && Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf-8');
    try {
      const parsed = JSON.parse(raw);
      result.topic = result.topic || parsed.topic || parsed.type;
      result.id = result.id || parsed.id || parsed.data?.id;
    } catch {
      const params = new URLSearchParams(raw);
      result.topic = result.topic || (params.get('topic') ?? undefined);
      result.id = result.id || (params.get('id') ?? undefined);
    }
  } else if (!result.topic && typeof req.body === 'object' && req.body !== null) {
    result.topic = result.topic || req.body.topic || req.body.type;
    result.id = result.id || req.body.id || req.body.data?.id;
  }

  result.topic = result.topic || (req.query.topic as string);
  result.id = result.id || (req.query.id as string);

  return result;
}

router.post('/mercadopago', async (req: Request, res: Response) => {
  try {
    if (!verifyMpSignature(req)) {
      console.warn('[MP Webhook] Firma inválida, ignorando notificación');
      res.status(200).json({ received: true });
      return;
    }

    const { topic, id } = extractTopicId(req);

    if (!topic || !id) {
      res.status(200).json({ received: true });
      return;
    }

    if (topic === 'payment') {
      await mercadopagoService.handlePaymentNotification(id);
    } else if (topic === 'preapproval' || topic === 'subscription') {
      await mercadopagoService.handleSubscriptionNotification(id);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MP Webhook] Error:', errorMessage);

    try {
      const { topic, id } = extractTopicId(req);
      if (topic && id) {
        await db.insert(failedWebhooks).values({
          topic,
          resourceId: id,
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
});

export default router;

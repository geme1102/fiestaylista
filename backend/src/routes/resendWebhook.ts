import { Router } from 'express';
import type { Request, Response } from 'express';
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../db/index.js';
import { emailSuppressions } from '../db/schema.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('ResendWebhook');
const router = Router();

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    created_at?: string;
    from?: string;
    to?: string[];
    subject?: string;
  };
}

function verifySvixSignature(req: Request, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  const svixId = req.headers['svix-id'] as string | undefined;
  const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
  const svixSignature = req.headers['svix-signature'] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSig = createHmac('sha256', Buffer.from(secret.split('_')[1] || secret, 'base64'))
    .update(signedContent)
    .digest('base64');

  const parts = svixSignature.split(' ');
  for (const part of parts) {
    if (part.startsWith('v1=')) {
      const sig = part.slice(3);
      try {
        return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
      } catch {
        return false;
      }
    }
  }
  return false;
}

router.post('/resend', express.raw({ type: '*/*', limit: '1mb' }), async (req: Request, res: Response) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : '';
    const secret = process.env.RESEND_WEBHOOK_SECRET;

    if (secret && !verifySvixSignature(req, rawBody)) {
      log.warn('Firma Svix inválida en webhook de Resend — rechazado');
      res.status(403).json({ received: false, error: 'Firma inválida' });
      return;
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const event = body as ResendWebhookEvent;

    const type = event?.type || '';
    const email = event?.data?.to?.[0] || null;

    if (!email) {
      res.status(200).json({ received: true });
      return;
    }

    if (type === 'email.bounced' || type === 'email.complained') {
      const reason = type === 'email.complained' ? 'complaint' : 'bounce';
      await db
        .insert(emailSuppressions)
        .values({ email, reason })
        .onConflictDoNothing();

      log.warn({ email, type }, 'Email suprimido por bounce/complaint de Resend');
    }

    res.status(200).json({ received: true });
  } catch (err) {
    log.error({ err }, 'Error procesando webhook de Resend:');
    res.status(200).json({ received: true });
  }
});

export default router;

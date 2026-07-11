import { Router } from 'express';
import type { Request, Response } from 'express';
import express from 'express';
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

router.post('/resend', express.raw({ type: '*/*', limit: '1mb' }), async (req: Request, res: Response) => {
  try {
    const body = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf-8'))
      : req.body;
    const event = body as ResendWebhookEvent;

    const type = event?.type || '';
    const email = event?.data?.to?.[0] || null;

    if (!email) {
      res.status(200).json({ received: true });
      return;
    }

    if (type === 'email.bounced' || type === 'email.complained') {
      const reason = type === 'email.complained' ? 'complaint' : `bounce:${email}`;
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

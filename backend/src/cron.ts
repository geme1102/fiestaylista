import { eq, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { failedWebhooks } from './db/schema.js';
import { processReminders } from './services/reminder.js';
import { processEmailSequence } from './services/emailSequence.js';
import { expireStaleSubscriptions } from './services/subscription.js';
import { cleanupStaleContributions } from './services/cashFund.js';
import * as mercadopagoService from './services/mercadopago.js';

let cronInterval: ReturnType<typeof setInterval> | null = null;
const locks = new Map<string, boolean>();

export function startCronJobs(): void {
  console.log('[Cron] Iniciando jobs programados...');

  const DAILY_MS = 24 * 60 * 60 * 1000;

  const runWithLock = async (name: string, fn: () => Promise<void>) => {
    if (locks.get(name)) {
      console.log(`[Cron] Saltando ${name} - ejecución anterior aún en progreso`);
      return;
    }
    locks.set(name, true);
    try {
      await fn();
    } finally {
      locks.set(name, false);
    }
  };

  const runDaily = async () => {
    await runWithLock('daily', async () => {
      try {
        const result = await processReminders();
        if (result.processed > 0) {
          console.log(`[Cron] Recordatorios: ${result.reminded}/${result.processed} eventos procesados`);
        }
      } catch (error) {
        console.error('[Cron] Error en recordatorios:', error);
      }

      try {
        const result = await processEmailSequence();
        if (result.processed > 0) {
          console.log(`[Cron] Email sequence: ${result.processed} emails enviados`);
        }
      } catch (error) {
        console.error('[Cron] Error en email sequence:', error);
      }

      try {
        const expired = await expireStaleSubscriptions();
        if (expired > 0) {
          console.log(`[Cron] Suscripciones expiradas: ${expired}`);
        }
      } catch (error) {
        console.error('[Cron] Error expirando suscripciones:', error);
      }

      try {
        const staleCount = await cleanupStaleContributions();
        if (staleCount > 0) {
          console.log(`[Cron] Contribuciones expiradas: ${staleCount}`);
        }
      } catch (error) {
        console.error('[Cron] Error limpiando contribuciones:', error);
      }
    });
  };

  const retryFailedWebhooks = async () => {
    await runWithLock('retry-webhooks', async () => {
      try {
        const failed = await db
          .select()
          .from(failedWebhooks)
          .where(sql`${failedWebhooks.nextRetryAt} <= NOW() AND ${failedWebhooks.status} = 'pending' AND ${failedWebhooks.retryCount} < 5`)
          .limit(20);

        for (const webhook of failed) {
          try {
            if (webhook.topic === 'payment') {
              await mercadopagoService.handlePaymentNotification(webhook.resourceId);
            } else if (webhook.topic === 'preapproval' || webhook.topic === 'subscription') {
              await mercadopagoService.handleSubscriptionNotification(webhook.resourceId);
            }

            await db
              .update(failedWebhooks)
              .set({ status: 'completed' })
              .where(eq(failedWebhooks.id, webhook.id));
          } catch (error) {
            const backoffMinutes = Math.pow(2, webhook.retryCount + 1);
            await db
              .update(failedWebhooks)
              .set({
                retryCount: webhook.retryCount + 1,
                lastAttemptAt: new Date(),
                nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
                errorMessage: error instanceof Error ? error.message : String(error),
              })
              .where(eq(failedWebhooks.id, webhook.id));
          }
        }
      } catch (error) {
        console.error('[Cron] Error en retry de webhooks:', error);
      }
    });
  };

  const cleanupExpiredTokens = async () => {
    try {
      const result = await db
        .delete(failedWebhooks)
        .where(sql`${failedWebhooks.createdAt} < NOW() - INTERVAL '7 days' AND ${failedWebhooks.status} = 'completed'`);
      if (result && result.length > 0) {
        console.log(`[Cron] Limpieza de webhooks completados: ${result.length}`);
      }
    } catch (error) {
      console.error('[Cron] Error en limpieza:', error);
    }
  };

  runDaily();
  cronInterval = setInterval(() => {
    runDaily();
    retryFailedWebhooks();
    cleanupExpiredTokens();
  }, DAILY_MS);

  console.log('[Cron] Jobs iniciados correctamente');
}

export function stopCronJobs(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[Cron] Jobs detenidos');
  }
}

import { eq, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { failedWebhooks, refreshTokens, eventViews, auditLogs } from './db/schema.js';
import { processReminders } from './services/reminder.js';
import { processEmailSequence } from './services/emailSequence.js';
import { expireStaleSubscriptions } from './services/subscription.js';
import { cleanupStaleContributions } from './services/cashFund.js';
import * as mpWebhooks from './services/mp-webhooks.js';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Cron');

let cronInterval: ReturnType<typeof setInterval> | null = null;
let webhookRetryInterval: ReturnType<typeof setInterval> | null = null;

const runWithLock = async (name: string, fn: () => Promise<void>) => {
  try {
    const acquired = await db.transaction(async (tx) => {
      const [result] = await tx.execute(sql`SELECT pg_try_advisory_lock(hashtext(${name})) as acquired`);
      const row = result as Record<string, unknown>;
      const locked = row !== null && (
        row.acquired === true ||
        Array.isArray(result) && result[0] === true
      );
      if (!locked) return false;
      await fn();
      await tx.execute(sql`SELECT pg_advisory_unlock(hashtext(${name}))`);
      return true;
    });
    if (!acquired) {
      log.info(`Saltando ${name} - lock no adquirido (otra instancia está ejecutando)`);
    }
  } catch (error) {
    log.error({ error }, `Error en lock para ${name}:`);
  }
};

export function startCronJobs(): void {
  log.info('Iniciando jobs programados...');

  const DAILY_MS = 24 * 60 * 60 * 1000;

  const runDaily = async () => {
    await runWithLock('daily', async () => {
      try {
        const result = await processReminders();
        if (result.processed > 0) {
          log.info(`Recordatorios: ${result.reminded}/${result.processed} eventos procesados`);
        }
      } catch (error) {
        log.error({ error }, 'Error en recordatorios:');
      }

      try {
        const result = await processEmailSequence();
        if (result.processed > 0) {
          log.info(`Email sequence: ${result.processed} emails enviados`);
        }
      } catch (error) {
        log.error({ error }, 'Error en email sequence:');
      }

      try {
        const expired = await expireStaleSubscriptions();
        if (expired > 0) {
          log.info(`Suscripciones expiradas: ${expired}`);
        }
      } catch (error) {
        log.error({ error }, 'Error expirando suscripciones:');
      }

      try {
        const staleCount = await cleanupStaleContributions();
        if (staleCount > 0) {
          log.info(`Contribuciones expiradas: ${staleCount}`);
        }
      } catch (error) {
        log.error({ error }, 'Error limpiando contribuciones:');
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
              await mpWebhooks.handlePaymentNotification(webhook.resourceId);
            } else if (webhook.topic === 'preapproval' || webhook.topic === 'subscription') {
              await mpWebhooks.handleSubscriptionNotification(webhook.resourceId);
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
        log.error({ error }, 'Error en retry de webhooks:');
      }
    });
  };

  const cleanupExpiredWebhooks = async () => {
    try {
      const result = await db
        .delete(failedWebhooks)
        .where(sql`${failedWebhooks.createdAt} < NOW() - INTERVAL '7 days' AND ${failedWebhooks.status} = 'completed'`);
      if (result && result.length > 0) {
        log.info(`Limpieza de webhooks completados: ${result.length}`);
      }
    } catch (error) {
      log.error({ error }, 'Error en limpieza:');
    }
  };

  const cleanupExpiredRefreshTokens = async () => {
    try {
      await db
        .delete(refreshTokens)
        .where(sql`${refreshTokens.expiresAt} < NOW()`);
    } catch (error) {
      log.error({ error }, 'Error limpiando refresh tokens:');
    }
  };

  const cleanupEventViews = async () => {
    try {
      const result = await db
        .delete(eventViews)
        .where(sql`${eventViews.viewedAt} < NOW() - INTERVAL '90 days'`);
      if (result.length > 0) {
        log.info(`Viejas vistas de eventos limpiadas: ${result.length}`);
      }
    } catch (error) {
      log.error({ error }, 'Error limpiando event_views:');
    }
  };

  const cleanupAuditLogs = async () => {
    try {
      const result = await db
        .delete(auditLogs)
        .where(sql`${auditLogs.createdAt} < NOW() - INTERVAL '180 days'`);
      if (result.length > 0) {
        log.info(`Audit logs viejos limpiados: ${result.length}`);
      }
    } catch (error) {
      log.error({ error }, 'Error limpiando audit_logs:');
    }
  };

  cleanupExpiredRefreshTokens();
  cleanupEventViews();
  cleanupAuditLogs();

  retryFailedWebhooks();
  cleanupExpiredWebhooks();
  runDaily();

  const WEBHOOK_RETRY_MS = 60 * 1000;

  cronInterval = setInterval(() => {
    runDaily();
    cleanupExpiredWebhooks();
    cleanupExpiredRefreshTokens();
    cleanupEventViews();
    cleanupAuditLogs();
  }, DAILY_MS);

  webhookRetryInterval = setInterval(() => {
    retryFailedWebhooks();
  }, WEBHOOK_RETRY_MS);

  log.info('Jobs iniciados correctamente');
}

export function stopCronJobs(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
  if (webhookRetryInterval) {
    clearInterval(webhookRetryInterval);
    webhookRetryInterval = null;
  }
  log.info('Jobs detenidos');
}

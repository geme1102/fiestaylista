import { eq, and, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { failedWebhooks, refreshTokens, subscriptions } from './db/schema.js';
import { processReminders } from './services/reminder.js';
import { processEmailSequence } from './services/emailSequence.js';
import { expireStaleSubscriptions, purgeExpiredData, sendPurgeWarnings } from './services/subscription.js';
import { reconcileCashFunds } from './services/cashFund.js';
import * as mpWebhooks from './services/mp-webhooks.js';
import * as mercadopagoService from './services/mercadopago.js';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Cron');

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

let cronInterval: ReturnType<typeof setInterval> | null = null;
let webhookRetryInterval: ReturnType<typeof setInterval> | null = null;
let cashReconcileInterval: ReturnType<typeof setInterval> | null = null;

export const runWithLock = async (name: string, fn: () => Promise<void>) => {
  try {
    let acquired = false;
    await db.transaction(async (tx) => {
      const [result] = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(1, hashtext(${name})) as acquired`);
      const row = Array.isArray(result) ? result[0] : result;
      acquired = row !== null && (row as Record<string, unknown>)?.acquired === true;
    });

    if (!acquired) {
      log.info(`Saltando ${name} - lock no adquirido (otra instancia está ejecutando)`);
      return;
    }

    await fn();
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
        const purged = await purgeExpiredData();
        if (purged > 0) {
          log.info(`Usuarios purgados: ${purged}`);
        }
      } catch (error) {
        log.error({ error }, 'Error purgando datos expirados:');
      }

      try {
        const warned = await sendPurgeWarnings();
        if (warned > 0) {
          log.info(`Warnings de purga enviados: ${warned}`);
        }
      } catch (error) {
        log.error({ error }, 'Error enviando warnings de purga:');
      }

      await reconcileStuckSubscriptions();
    });
  };

  const reconcileStuckSubscriptions = async () => {
    await runWithLock('reconcile-subscriptions', async () => {
      try {
        const stuck = await db
          .select({ id: subscriptions.id, userId: subscriptions.userId, tier: subscriptions.tier, currentPeriodStart: subscriptions.currentPeriodStart, currentPeriodEnd: subscriptions.currentPeriodEnd })
          .from(subscriptions)
          .where(and(
            sql`${subscriptions.status} IN ('pending_approval', 'incomplete')`,
            sql`${subscriptions.createdAt} < NOW() - INTERVAL '1 hour'`,
          ));

        for (let i = 0; i < stuck.length; i++) {
          const sub = stuck[i];
          try {
            const interval = sub.currentPeriodEnd && sub.currentPeriodStart
              ? (sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime() > 330 * 24 * 60 * 60 * 1000 ? 'year' : 'month')
              : 'month';
            const ref = `${sub.tier}_${sub.userId}_${interval}`;
            const mpPayment = await mercadopagoService.searchPaymentsByRef(ref);
            if (mpPayment) {
              await mpWebhooks.handlePaymentNotification(mpPayment.id);
            } else {
              // Also check preapprovals
              const preapproval = await mercadopagoService.searchPreapprovalsByRef(ref);
              if (preapproval) {
                await mpWebhooks.handleSubscriptionNotification(preapproval.id);
              }
            }
          } catch (err) {
            log.error({ err, userId: sub.userId }, 'Error reconciliando suscripción atascada:');
          }
          if (i % 5 === 4) await yieldToEventLoop();
        }

        if (stuck.length > 0) {
          log.info({ count: stuck.length }, 'Suscripciones atascadas reconciliadas');
        }
      } catch (error) {
        log.error({ error }, 'Error en reconciliación de suscripciones:');
      }
    });
  };

  const reconcileCashFundsJob = async () => {
    await runWithLock('reconcile-cash-funds', async () => {
      try {
        const result = await reconcileCashFunds();
        if (result.checked > 0) {
          log.info({ fixed: result.fixed, checked: result.checked }, `Cash funds reconciliados: ${result.fixed} corregidos de ${result.checked}`);
        }
      } catch (error) {
        log.error({ error }, 'Error reconciliando cash funds:');
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

        for (let i = 0; i < failed.length; i++) {
          const webhook = failed[i];
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
          if (i % 5 === 4) await yieldToEventLoop();
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
        .where(sql`(${failedWebhooks.createdAt} < NOW() - INTERVAL '7 days' AND ${failedWebhooks.status} = 'completed') OR (${failedWebhooks.createdAt} < NOW() - INTERVAL '1 day' AND ${failedWebhooks.status} = 'pending' AND ${failedWebhooks.retryCount} >= 5)`);
      if (result && result.length > 0) {
        log.info(`Limpieza de webhooks: ${result.length}`);
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
      const BATCH_SIZE = 1000;
      const MAX_BATCHES = 50;
      let totalDeleted = 0;

      for (let i = 0; i < MAX_BATCHES; i++) {
        const result = await db.execute(
          sql`DELETE FROM "event_views" WHERE "id" IN (SELECT "id" FROM "event_views" WHERE "viewed_at" < NOW() - INTERVAL '90 days' LIMIT ${sql.raw(String(BATCH_SIZE))})`,
        );
        const affected = (result as any).rowCount ?? (result as any).length ?? 0;
        totalDeleted += affected;
        if (affected < BATCH_SIZE) break;
        if (i % 10 === 9) await yieldToEventLoop();
      }

      if (totalDeleted > 0) {
        log.info(`Viejas vistas de eventos limpiadas: ${totalDeleted} registros`);
      }
    } catch (error) {
      log.error({ error }, 'Error limpiando event_views:');
    }
  };

  const cleanupAuditLogs = async () => {
    // Audit logs are now immutable — cleanup is handled by DB-level partitioning/retention
    log.info('Audit log cleanup skipped — logs are immutable');
  }

  cleanupExpiredRefreshTokens().catch((err) => log.error({ err }, 'cleanupExpiredRefreshTokens falló'));
  cleanupEventViews().catch((err) => log.error({ err }, 'cleanupEventViews falló'));
  cleanupAuditLogs().catch((err) => log.error({ err }, 'cleanupAuditLogs falló'));

  retryFailedWebhooks().catch((err) => log.error({ err }, 'retryFailedWebhooks falló'));
  cleanupExpiredWebhooks().catch((err) => log.error({ err }, 'cleanupExpiredWebhooks falló'));
  runDaily().catch((err) => log.error({ err }, 'runDaily falló'));
  reconcileCashFundsJob().catch((err) => log.error({ err }, 'reconcileCashFundsJob falló'));

  const WEBHOOK_RETRY_MS = 60 * 1000;

  cronInterval = setInterval(() => {
    runDaily().catch((err) => log.error({ err }, 'runDaily falló'));
    cleanupExpiredWebhooks().catch((err) => log.error({ err }, 'cleanupExpiredWebhooks falló'));
    cleanupExpiredRefreshTokens().catch((err) => log.error({ err }, 'cleanupExpiredRefreshTokens falló'));
    cleanupEventViews().catch((err) => log.error({ err }, 'cleanupEventViews falló'));
    cleanupAuditLogs().catch((err) => log.error({ err }, 'cleanupAuditLogs falló'));
  }, DAILY_MS);

  webhookRetryInterval = setInterval(() => {
    retryFailedWebhooks().catch((err) => log.error({ err }, 'retryFailedWebhooks falló'));
  }, WEBHOOK_RETRY_MS);

  const CASH_RECONCILLE_MS = 6 * 60 * 60 * 1000;

  cashReconcileInterval = setInterval(() => {
    reconcileCashFundsJob().catch((err) => log.error({ err }, 'reconcileCashFundsJob falló'));
  }, CASH_RECONCILLE_MS);

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
  if (cashReconcileInterval) {
    clearInterval(cashReconcileInterval);
    cashReconcileInterval = null;
  }
  log.info('Jobs detenidos');
}

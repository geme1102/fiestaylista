import cluster from 'node:cluster';
import { cpus } from 'node:os';
import { config } from './config.js';
import { sql } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import type { Express } from 'express';
import { startCronJobs, stopCronJobs } from './cron.js';
import { stopSSEScavenger } from './services/notifications.js';
import { logger } from './utils/logger.js';

let app: Express | undefined;

const workerCount = config.CLUSTER_WORKERS > 0 ? config.CLUSTER_WORKERS : (config.NODE_ENV === 'production' ? 1 : 0);

if (cluster.isPrimary && workerCount > 1) {
  logger.info({ workers: workerCount }, 'Modo cluster iniciando workers');

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn({ pid: worker.process.pid, code, signal }, 'Worker muerto — reiniciando');
    cluster.fork();
  });

  const shutdownSignal = (signal: string) => {
    logger.warn({ signal }, 'Cerrando cluster...');
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdownSignal('SIGTERM'));
  process.on('SIGINT', () => shutdownSignal('SIGINT'));
} else {
  app = createApp();

  const server = app.listen(config.PORT, () => {
    logger.info({
      port: config.PORT,
      environment: config.NODE_ENV,
      frontend: config.FRONTEND_URL,
      backend: config.BACKEND_URL,
      workerId: cluster.isWorker ? `worker-${cluster.worker?.id}` : 'primary',
    }, 'Servidor iniciado — aplicando migraciones en background');
    startCronJobs();
  });

  // Migraciones en background para no bloquear healthcheck de Railway
  runMigrations().catch((err) => {
    logger.fatal({ err }, 'Error aplicando migraciones');
    process.exit(1);
  });

  server.timeout = 30000;
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 31000;

  const SHUTDOWN_TIMEOUT = 10_000;

  function gracefulShutdown(signal: string) {
    logger.warn({ signal }, 'Cerrando servidor...');
    stopSSEScavenger();
    stopCronJobs();
    server.close(() => {
      sql.end({ timeout: 5 }).then(() => {
        logger.info('Conexiones cerradas correctamente.');
        process.exit(0);
      });
    });
    setTimeout(() => {
      logger.error('Timeout de cierre forzado.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Excepción no capturada');
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Promesa rechazada no capturada');
    gracefulShutdown('unhandledRejection');
  });
}

export default app;

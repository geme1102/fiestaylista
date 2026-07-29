console.log('[startup] Iniciando servidor...');

import cluster from 'node:cluster';
import type { Worker } from 'node:cluster';
import { config } from './config.js';
import { sql } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import express, { type Express } from 'express';
import { startCronJobs, stopCronJobs } from './cron.js';
import { stopSSEScavenger } from './services/notifications.js';
import { startSSEListener, startHeartbeatSender, stopSSEListener } from './services/sse-pubsub.js';
import { logger } from './utils/logger.js';

console.log('[startup] Imports cargados correctamente');

const workerCount = config.CLUSTER_WORKERS > 0 ? config.CLUSTER_WORKERS : (config.NODE_ENV === 'production' ? 1 : 0);
const SHUTDOWN_TIMEOUT = 30_000;

if (cluster.isPrimary && workerCount > 1) {
  logger.info({ workers: workerCount }, 'Modo cluster iniciando workers');

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  let isShuttingDown = false;
  let restartAttempts = 0;
  const MAX_RESTART_ATTEMPTS = 10;
  const RESTART_BACKOFF_BASE_MS = 1000;

  cluster.on('exit', (worker, code, signal) => {
    if (isShuttingDown) return;
    restartAttempts++;
    if (restartAttempts > MAX_RESTART_ATTEMPTS) {
      logger.fatal({ attempts: restartAttempts }, 'Demasiados reinicios de worker — abortando cluster');
      process.exit(1);
    }
    const delay = Math.min(RESTART_BACKOFF_BASE_MS * Math.pow(2, restartAttempts - 1), 30000);
    logger.warn({ pid: worker.process.pid, code, signal, attempts: restartAttempts, delay }, 'Worker muerto — reiniciando con backoff');
    setTimeout(() => cluster.fork(), delay);
  });

  const shutdownSignal = async (signal: string) => {
    isShuttingDown = true;
    logger.warn({ signal }, 'Cerrando cluster — esperando workers...');

    const aliveWorkers = Object.values(cluster.workers ?? {}).filter(Boolean) as Worker[];
    if (aliveWorkers.length === 0) {
      process.exit(0);
      return;
    }

    const exitPromises = aliveWorkers.map(w => new Promise<void>(resolve => {
      w.on('exit', () => resolve());
      w.kill();
    }));

    const timeout = setTimeout(() => {
      logger.error('Timeout esperando workers — forzando salida');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);

    await Promise.all(exitPromises);
    clearTimeout(timeout);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdownSignal('SIGTERM'));
  process.on('SIGINT', () => shutdownSignal('SIGINT'));
} else {
  let app: Express;

  try {
    console.log('[startup] Creando aplicación...');
    app = createApp();
    console.log('[startup] Aplicación creada exitosamente');
  } catch (e) {
    console.error('[startup] Error creando aplicación:', e);
    if (config.NODE_ENV === 'production') {
      logger.fatal({ err: e }, 'createApp() falló en producción — abortando');
      process.exit(1);
    }
    app = express();
    app.get('/api/health', (_req, res) => res.status(500).json({ status: 'error', message: 'Falló al crear la app Express' }));
    app.get('/health', (_req, res) => res.status(500).json({ status: 'error', message: 'Falló al crear la app Express' }));
  }

  (async () => {
    console.log('[startup] Aplicando migraciones antes de iniciar servidor...');
    let migrationsOk = false;
    try {
      await runMigrations();
      migrationsOk = true;
      console.log('[startup] Migraciones aplicadas correctamente');
    } catch (err) {
      logger.fatal({ err }, 'Error aplicando migraciones');
      if (config.NODE_ENV === 'production') {
        logger.fatal('Migraciones fallaron en producción — abortando arranque');
        process.exit(1);
      }
      console.log('[startup] Error en migraciones (dev), continuando en modo degradado...');
    }

    console.log('[startup] Iniciando servidor en puerto', config.PORT);
    const server = app.listen(config.PORT, () => {
      logger.info({
        port: config.PORT,
        environment: config.NODE_ENV,
        frontend: config.FRONTEND_URL,
        backend: config.BACKEND_URL,
        workerId: cluster.isWorker ? `worker-${cluster.worker?.id}` : 'primary',
      }, 'Servidor iniciado');
      if (migrationsOk) {
        startCronJobs();
        startSSEListener();
        startHeartbeatSender();
      }
    });

    server.timeout = 30000;
    server.keepAliveTimeout = 5000;
    server.headersTimeout = 31000;

    function gracefulShutdown(signal: string, exitCode = 0) {
      logger.warn({ signal, exitCode }, 'Cerrando servidor...');
      stopSSEScavenger();
      stopSSEListener();
      if (migrationsOk) stopCronJobs();
      server.close(() => {
        sql.end({ timeout: 5 }).then(() => {
          logger.info('Conexiones cerradas correctamente.');
          process.exit(exitCode);
        });
      });
      setTimeout(() => {
        logger.error('Timeout de cierre forzado.');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT);
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));
    process.on('uncaughtException', (error) => {
      logger.fatal({ err: error }, 'Excepción no capturada — estado inestable, saliendo inmediatamente');
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.fatal({ err: reason }, 'Promesa rechazada no capturada — reiniciando servidor');
      gracefulShutdown('unhandledRejection', 1);
    });
  })();
}

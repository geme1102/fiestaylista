console.log('[startup] Iniciando servidor...');

import cluster from 'node:cluster';
import { config } from './config.js';
import { sql } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import express, { type Express } from 'express';
import { startCronJobs, stopCronJobs } from './cron.js';
import { stopSSEScavenger } from './services/notifications.js';
import { logger } from './utils/logger.js';

console.log('[startup] Imports cargados correctamente');

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
  let app: Express;

  try {
    console.log('[startup] Creando aplicación...');
    app = createApp();
    console.log('[startup] Aplicación creada exitosamente');
  } catch (e) {
    console.error('[startup] Error creando aplicación:', e);
    app = express();
    app.get('/api/health', (_req, res) => res.json({ status: 'error', message: 'Falló al crear la app Express' }));
    app.get('/health', (_req, res) => res.json({ status: 'error', message: 'Falló al crear la app Express' }));
  }

  (async () => {
    console.log('[startup] Aplicando migraciones antes de iniciar servidor...');
    let migrationsOk = false;
    try {
      await runMigrations();
      migrationsOk = true;
      console.log('[startup] Migraciones aplicadas correctamente');
    } catch (err) {
      logger.fatal({ err }, 'Error aplicando migraciones — el servidor continuará en modo degradado');
      console.log('[startup] Error en migraciones, continuando en modo degradado...');
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
      if (migrationsOk) startCronJobs();
    });

    server.timeout = 30000;
    server.keepAliveTimeout = 5000;
    server.headersTimeout = 31000;

    const SHUTDOWN_TIMEOUT = 10_000;

    function gracefulShutdown(signal: string, exitCode = 0) {
      logger.warn({ signal, exitCode }, 'Cerrando servidor...');
      stopSSEScavenger();
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
      logger.fatal({ err: error }, 'Excepción no capturada');
      gracefulShutdown('uncaughtException', 1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error({ err: reason }, 'Promesa rechazada no capturada — el servidor continúa funcionando');
    });
  })();
}

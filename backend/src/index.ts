import { config } from './config.js';
import { sql } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import { startCronJobs, stopCronJobs } from './cron.js';
import { stopSSEScavenger } from './services/notifications.js';
import { logger } from './utils/logger.js';

const app = createApp();

try {
  await runMigrations();
} catch (err) {
  logger.fatal({ err }, 'Error aplicando migraciones');
  process.exit(1);
}

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, environment: config.NODE_ENV, frontend: config.FRONTEND_URL, backend: config.BACKEND_URL }, 'Servidor iniciado');
  startCronJobs();
});

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

export default app;

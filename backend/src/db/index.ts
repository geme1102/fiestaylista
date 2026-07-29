import cluster from 'node:cluster';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('DB');

const isPrimary = typeof cluster.isPrimary === 'boolean' ? cluster.isPrimary : true;
const workerCount = isPrimary
  ? (config.CLUSTER_WORKERS > 0 ? config.CLUSTER_WORKERS : 1)
  : 1;

// Pool reducido para escalabilidad horizontal:
// - Default 5 conexiones por instancia Railway.
// - SSE pub/sub abre 1 conexión adicional via sql.listen() fuera del pool.
// - Con 10 instancias → ~60 conexiones totales (5 pool + 1 SSE).
// - Neon recomienda PgBouncer (modo transacción) para evitar Connection Limit Exceeded.
//   Configurar DATABASE_URL con host '-pooler' o ?pgbouncer=true
//   para enrutar conexiones a través del pool administrado de Neon.
const poolMax = Math.max(1, Math.floor(config.DB_POOL_MAX / workerCount));

// Auto-transformar URL para agregar ?pgbouncer=true en Neon si no está presente
let databaseUrl = config.DATABASE_URL;
try {
  const parsed = new URL(databaseUrl);
  const isNeon = parsed.hostname.endsWith('.neon.tech');
  const hasPooler = parsed.hostname.includes('-pooler') || databaseUrl.includes('pgbouncer=true');
  if (isNeon && !hasPooler) {
    const separator = databaseUrl.includes('?') ? '&' : '?';
    databaseUrl = `${databaseUrl}${separator}pgbouncer=true`;
    log.info('PgBouncer auto-configurado: añadido ?pgbouncer=true a DATABASE_URL');
  }
} catch { /* URL inválida — config.ts ya fallará */ }

// SSL incondicional para conexiones non-localhost.
// En producción: rejectUnauthorized verifica el CA de Neon.
// En docker-compose (localhost): SSL desactivado.
const dbHost = (() => {
  try { return new URL(databaseUrl).hostname; } catch { return ''; }
})();
const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '0.0.0.0';
const sslConfig = isLocalhost ? false : { rejectUnauthorized: true };

const sql = postgres(databaseUrl, {
  max: poolMax,
  ssl: sslConfig,
  connect_timeout: 30,
  idle_timeout: 30,
  max_lifetime: 60 * 30,
  prepare: false,
});

const db = drizzle(sql, { schema });

export { db, sql };

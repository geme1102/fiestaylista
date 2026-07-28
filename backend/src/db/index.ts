import cluster from 'node:cluster';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

const isPrimary = typeof cluster.isPrimary === 'boolean' ? cluster.isPrimary : true;
const workerCount = isPrimary
  ? (config.CLUSTER_WORKERS > 0 ? config.CLUSTER_WORKERS : 1)
  : 1;
// Pool reducido para escalabilidad horizontal:
// - Cada instancia Railway usa pocas conexiones (default 5).
// - El SSE pub/sub abre 1 conexión adicional vía sql.listen() fuera del pool.
// - Con 10 instancias → ~60 conexiones totales (5 pool + 1 SSE), dentro del límite de Neon.
// IMPORTANTE: Neon recomienda usar su pooler interno (PgBouncer) en modo transacción.
// Configurar DATABASE_URL con el host '-pooler' de Neon o añadir ?pgbouncer=true
// para que Neon enrute las conexiones a través de su pool administrado.
// Esto evita Connection Limit Exceeded al escalar a más instancias.
const poolMax = Math.max(3, Math.ceil((config.DB_POOL_MAX || 5) / workerCount));

// SSL incondicional para conexiones non-localhost.
// En producción: rejectUnauthorized verifica el CA de Neon.
// En desarrollo con docker-compose (localhost): SSL desactivado.
// Si alguien olvida NODE_ENV=production en Railway, el SSL igual se activa
// porque el host de Neon no es localhost.
const dbHost = (() => {
  try { return new URL(config.DATABASE_URL).hostname; } catch { return ''; }
})();
const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '0.0.0.0';
const sslConfig = isLocalhost ? false : { rejectUnauthorized: true };

const sql = postgres(config.DATABASE_URL, {
  max: poolMax,
  ssl: sslConfig,
  connect_timeout: 30,
  idle_timeout: 30,
  max_lifetime: 60 * 30,
  prepare: false,
});

const db = drizzle(sql, { schema });

export { db, sql };

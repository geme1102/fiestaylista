import cluster from 'node:cluster';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

const isPrimary = typeof cluster.isPrimary === 'boolean' ? cluster.isPrimary : true;
const workerCount = isPrimary
  ? (config.CLUSTER_WORKERS > 0 ? config.CLUSTER_WORKERS : 1)
  : 1;
const poolMax = Math.max(3, Math.ceil((config.DB_POOL_MAX || 10) / workerCount));

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

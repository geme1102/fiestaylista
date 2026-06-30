import cluster from 'node:cluster';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

// En cluster mode, dividir el pool entre workers para no exceder
// el límite de conexiones de Neon (plan free ~20 conexiones).
const isPrimary = typeof cluster.isPrimary === 'boolean' ? cluster.isPrimary : true;
const workerCount = isPrimary
  ? (config.CLUSTER_WORKERS > 0 ? config.CLUSTER_WORKERS : 1)
  : 1;
const poolMax = Math.max(3, Math.ceil((config.DB_POOL_MAX || 15) / workerCount));

const sql = postgres(config.DATABASE_URL, {
  max: poolMax,
  ssl: config.NODE_ENV === 'production' ? 'require' : false,
  connect_timeout: 10,
  idle_timeout: 30,
  max_lifetime: 60 * 30,
});

const db = drizzle(sql, { schema });

export { db, sql };

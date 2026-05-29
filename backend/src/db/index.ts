import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

const sql = postgres(config.DATABASE_URL, {
  max: 10,
  ssl: config.NODE_ENV === 'production' ? 'require' : false,
  connect_timeout: 10,
  idle_timeout: 30,
  max_lifetime: 60 * 30,
});

const db = drizzle(sql, { schema });

export { db, sql };

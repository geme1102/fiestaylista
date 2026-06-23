import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import { config } from '../config.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Migrations');

export async function runMigrations(): Promise<void> {
  const migrationsFolder = resolve(process.cwd(), 'src/db/migrations');
  const migrationClient = postgres(config.DATABASE_URL, {
    max: 1,
    ssl: config.NODE_ENV === 'production' ? 'require' : false,
    connect_timeout: 10,
  });
  try {
    const migrationDb = drizzle(migrationClient);
    await migrate(migrationDb, { migrationsFolder });
    log.info('Migraciones aplicadas correctamente');
  } finally {
    await migrationClient.end({ timeout: 5 });
  }
}

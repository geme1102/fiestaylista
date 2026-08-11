import { sql } from '../db/index.js';
import { createModuleLogger } from '../utils/logger.js';
import type { Store, ClientRateLimitInfo, IncrementResponse } from 'express-rate-limit';

const log = createModuleLogger('RateLimitStore');

const TABLE_NAME = 'rate_limits';
const CLEANUP_INTERVAL_MS = 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export class PostgresStore implements Store {
  localKeys = false;

  private windowMs: number = 60_000;
  private static initialized = false;

  async init(options: { windowMs?: number }): Promise<void> {
    this.windowMs = options.windowMs ?? 60_000;
    if (PostgresStore.initialized) return;
    PostgresStore.initialized = true;

    try {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS "${TABLE_NAME}" (
          "key" TEXT PRIMARY KEY,
          "points" INTEGER NOT NULL DEFAULT 0,
          "expires_at" TIMESTAMPTZ NOT NULL
        )
      `);
      await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON "${TABLE_NAME}"("expires_at")
      `);
    } catch (err) {
      log.error({ err }, 'Error creando tabla rate_limits');
    }

    if (!cleanupTimer) {
      cleanupTimer = setInterval(() => {
        sql.unsafe(`DELETE FROM "${TABLE_NAME}" WHERE "expires_at" < NOW() - INTERVAL '1 hour'`).catch(() => {});
      }, CLEANUP_INTERVAL_MS);
    }
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    try {
      const rows = await sql.unsafe<Array<{ points: number; expires_at: string }>>(
        `SELECT "points", "expires_at" FROM "${TABLE_NAME}" WHERE "key" = $1 AND "expires_at" > NOW()`,
        [key],
      );
      if (rows.length === 0) return undefined;
      return { totalHits: rows[0].points, resetTime: new Date(rows[0].expires_at) };
    } catch {
      return undefined;
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    try {
      const interval = `${this.windowMs / 1000} seconds`;
      const rows = await sql.unsafe<Array<{ points: number; expires_at: string }>>(
        `INSERT INTO "${TABLE_NAME}" ("key", "points", "expires_at")
         VALUES ($1, 1, NOW() + $2::interval)
         ON CONFLICT ("key") DO UPDATE SET
           "points" = CASE WHEN "${TABLE_NAME}"."expires_at" < NOW() THEN 1 ELSE "${TABLE_NAME}"."points" + 1 END,
           "expires_at" = CASE WHEN "${TABLE_NAME}"."expires_at" < NOW() THEN EXCLUDED."expires_at" ELSE "${TABLE_NAME}"."expires_at" END
         RETURNING "points", "expires_at"`,
        [key, interval],
      );
      return { totalHits: rows[0].points, resetTime: new Date(rows[0].expires_at) };
    } catch (err) {
      // D2-A3: fail-open REAL — devolver totalHits: 0 hacía que express-rate-limit
      // lanzara ERR_ERL_INVALID_HITS (500 por request). Al lanzar aquí, el limiter
      // con passOnStoreError: true deja pasar el request.
      log.error({ err, key }, 'Rate limit store increment falló — permitiendo request (passOnStoreError)');
      throw err;
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await sql.unsafe(
        `UPDATE "${TABLE_NAME}" SET "points" = GREATEST(0, "points" - 1) WHERE "key" = $1 AND "expires_at" > NOW()`,
        [key],
      );
    } catch {}
  }

  async resetKey(key: string): Promise<void> {
    try {
      await sql.unsafe(`DELETE FROM "${TABLE_NAME}" WHERE "key" = $1`, [key]);
    } catch {}
  }

  async resetAll(): Promise<void> {
    try {
      await sql.unsafe(`TRUNCATE "${TABLE_NAME}"`);
    } catch {}
  }

  async shutdown(): Promise<void> {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }
}

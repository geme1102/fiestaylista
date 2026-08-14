import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/index.js', () => ({
  sql: Object.assign(vi.fn(), { unsafe: vi.fn() }),
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { COLUMN_MIGRATIONS, isIdempotentError, runMigrations } from '../db/migrate.js';

describe('migraciones', () => {
  it('F2: isIdempotentError solo absorbe "already exists" (no errores reales)', () => {
    expect(isIdempotentError(new Error('relation "x" already exists'))).toBe(true);
    expect(isIdempotentError(new Error('type "x" already exists'))).toBe(true);
    expect(isIdempotentError(new Error('duplicate key value violates unique constraint "cash_contributions_fund_name_key_unique"'))).toBe(false);
    expect(isIdempotentError(new Error('column "updated_at" of relation "cash_contributions" does not exist'))).toBe(false);
    expect(isIdempotentError('not an error')).toBe(false);
    expect(isIdempotentError(undefined)).toBe(false);
  });

  it('F2: el dedupe de cash_contributions_name_key no referencia updated_at (columna inexistente en cash_contributions)', () => {
    const migration = COLUMN_MIGRATIONS.find(m => m.name === 'cash_contributions_name_key');
    expect(migration).toBeDefined();

    const dedupeStatement = migration!.statements.find(s => s.includes('SET "status"'));
    expect(dedupeStatement).toBeDefined();
    expect(dedupeStatement!).not.toContain('updated_at');

    // cash_funds sí tiene updated_at: el recálculo de collected_amount debe mantenerlo
    const recalcStatement = migration!.statements.find(s => s.includes('UPDATE "cash_funds"'));
    expect(recalcStatement).toBeDefined();
    expect(recalcStatement!).toContain('updated_at');
  });

  it('nombres de migración únicos', () => {
    const names = COLUMN_MIGRATIONS.map(m => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('los statements del dedupe corren en orden: backfill → dedupe → delete → recálculo → not null → unique index', () => {
    const migration = COLUMN_MIGRATIONS.find(m => m.name === 'cash_contributions_name_key')!;
    const joined = migration.statements.join('\n---\n');

    const backfillIdx = joined.indexOf('lower(btrim("contributor_name"))');
    const dedupeIdx = joined.indexOf('SET "status" = \'cancelled\'');
    const deleteIdx = joined.indexOf('DELETE FROM "cash_contributions"');
    const recalcIdx = joined.indexOf('UPDATE "cash_funds"');
    const notNullIdx = joined.indexOf('SET NOT NULL');
    const uniqueIdx = joined.indexOf('CREATE UNIQUE INDEX');

    expect(backfillIdx).toBeGreaterThan(-1);
    expect(dedupeIdx).toBeGreaterThan(backfillIdx);
    expect(deleteIdx).toBeGreaterThan(dedupeIdx);
    expect(recalcIdx).toBeGreaterThan(deleteIdx);
    expect(notNullIdx).toBeGreaterThan(recalcIdx);
    expect(uniqueIdx).toBeGreaterThan(notNullIdx);
  });

  it('E7: sin lock pero con journal completo, el worker arranca sin esperar ni migrar', async () => {
    const { sql } = await import('../db/index.js');
    const mockSql = sql as unknown as ReturnType<typeof vi.fn> & { unsafe: ReturnType<typeof vi.fn> };
    mockSql.mockReset();
    mockSql.unsafe.mockReset();
    mockSql.unsafe.mockResolvedValue([]);
    // INSERT lock no lo consigue (otra instancia lo tiene) → [] , luego SELECT journal → completo
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        ...COLUMN_MIGRATIONS.map(m => ({ name: m.name })),
        { name: 'timestamptz_conversion' },
      ]);

    await runMigrations();

    // No intentó aplicar migraciones (3 unsafe = lock table + index + cleanup stale)
    expect(mockSql.unsafe).toHaveBeenCalledTimes(3);
  });
});

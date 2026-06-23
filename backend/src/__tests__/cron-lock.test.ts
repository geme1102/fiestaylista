import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/index.js', () => ({
  db: {
    transaction: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../services/reminder.js', () => ({ processReminders: vi.fn() }));
vi.mock('../services/emailSequence.js', () => ({ processEmailSequence: vi.fn() }));
vi.mock('../services/subscription.js', () => ({ expireStaleSubscriptions: vi.fn() }));
vi.mock('../services/cashFund.js', () => ({ cleanupStaleContributions: vi.fn() }));
vi.mock('../services/mp-webhooks.js', () => ({ retryFailedWebhooks: vi.fn() }));

import { runWithLock } from '../cron.js';
import { db } from '../db/index.js';

describe('runWithLock (C4) — lock transaccional sin fugas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ejecuta fn() cuando se adquiere el lock', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      await cb({
        execute: vi.fn().mockResolvedValue([{ acquired: true }]),
      });
    });

    await runWithLock('test-job', fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('NO ejecuta fn() cuando el lock no se adquiere (otra instancia)', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      await cb({
        execute: vi.fn().mockResolvedValue([{ acquired: false }]),
      });
    });

    await runWithLock('test-job', fn);

    expect(fn).not.toHaveBeenCalled();
  });

  it('NO propaga el error si fn() lanza (lo captura y loguea)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      await cb({
        execute: vi.fn().mockResolvedValue([{ acquired: true }]),
      });
    });

    // runWithLock envuelve todo en try/catch: el lock xact se libera al
    // hacer rollback la transacción, así que nunca se filtra.
    await expect(runWithLock('test-job', fn)).resolves.not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('NO propaga el error si la transacción misma falla', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.transaction).mockRejectedValue(new Error('db down'));

    await expect(runWithLock('test-job', fn)).resolves.not.toThrow();
  });
});

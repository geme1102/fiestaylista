import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgresStore } from '../middleware/rateLimitStore.js';

const mockUnsafe = vi.hoisted(() => vi.fn());

vi.mock('../db/index.js', () => ({
  sql: Object.assign(
    () => Promise.resolve([]),
    { unsafe: mockUnsafe },
  ),
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('PostgresStore', () => {
  let store: PostgresStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new PostgresStore();
  });

  afterEach(async () => {
    await store.shutdown();
  });

  describe('init', () => {
    it('creates table and index on first init', async () => {
      mockUnsafe.mockResolvedValue([]);

      await store.init({ windowMs: 60_000 });

      expect(mockUnsafe).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS'));
      expect(mockUnsafe).toHaveBeenCalledWith(expect.stringContaining('CREATE INDEX IF NOT EXISTS'));
    });

    it('sets windowMs from options', async () => {
      mockUnsafe.mockResolvedValue([]);

      await store.init({ windowMs: 30_000 });

      expect((store as any).windowMs).toBe(30_000);
    });

    it('defaults windowMs to 60s', async () => {
      mockUnsafe.mockResolvedValue([]);

      await store.init({});

      expect((store as any).windowMs).toBe(60_000);
    });

    it('does not create table twice on subsequent init', async () => {
      mockUnsafe.mockResolvedValue([]);
      await store.init({ windowMs: 60_000 });
      mockUnsafe.mockClear();

      await store.init({ windowMs: 60_000 });

      expect(mockUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('increment', () => {
    it('returns totalHits and resetTime on success', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      mockUnsafe.mockResolvedValue([{ points: 1, expires_at: future }]);

      const result = await store.increment('ip:127.0.0.1');

      expect(result.totalHits).toBe(1);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it('D2-A3: lanza en error de DB para que passOnStoreError del limiter deje pasar', async () => {
      mockUnsafe.mockRejectedValue(new Error('DB error'));

      await expect(store.increment('ip:127.0.0.1')).rejects.toThrow('DB error');
    });
  });

  describe('decrement', () => {
    it('calls sql.unsafe with correct params', async () => {
      mockUnsafe.mockResolvedValue([]);

      await store.decrement('ip:127.0.0.1');

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['ip:127.0.0.1'],
      );
    });

    it('does not throw on error', async () => {
      mockUnsafe.mockRejectedValue(new Error('DB error'));

      await expect(store.decrement('ip:127.0.0.1')).resolves.toBeUndefined();
    });
  });

  describe('resetKey', () => {
    it('calls sql.unsafe with DELETE', async () => {
      mockUnsafe.mockResolvedValue([]);

      await store.resetKey('ip:127.0.0.1');

      expect(mockUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        ['ip:127.0.0.1'],
      );
    });

    it('does not throw on error', async () => {
      mockUnsafe.mockRejectedValue(new Error('DB error'));

      await expect(store.resetKey('test-key')).resolves.toBeUndefined();
    });
  });

  describe('get', () => {
    it('returns undefined when key not found', async () => {
      mockUnsafe.mockResolvedValue([]);

      const result = await store.get('ip:nonexistent');

      expect(result).toBeUndefined();
    });

    it('returns client info when key exists', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      mockUnsafe.mockResolvedValue([{ points: 3, expires_at: future }]);

      const result = await store.get('ip:127.0.0.1');

      expect(result).toBeDefined();
      expect(result!.totalHits).toBe(3);
      expect(result!.resetTime).toBeInstanceOf(Date);
    });

    it('returns undefined on error', async () => {
      mockUnsafe.mockRejectedValue(new Error('DB error'));

      const result = await store.get('ip:127.0.0.1');

      expect(result).toBeUndefined();
    });
  });

  describe('resetAll', () => {
    it('calls sql.unsafe with TRUNCATE', async () => {
      mockUnsafe.mockResolvedValue([]);

      await store.resetAll();

      expect(mockUnsafe).toHaveBeenCalledWith(expect.stringContaining('TRUNCATE'));
    });

    it('does not throw on error', async () => {
      mockUnsafe.mockRejectedValue(new Error('DB error'));

      await expect(store.resetAll()).resolves.toBeUndefined();
    });
  });

  describe('localKeys', () => {
    it('is false (shared store)', () => {
      expect(store.localKeys).toBe(false);
    });
  });
});

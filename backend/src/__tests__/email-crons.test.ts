import { describe, it, expect, vi, beforeEach } from 'vitest';

// B1/B2: los crons de reminders y secuencia de emails excluyen eventos y regalos
// borrados (deletedAt) — antes mandaban correos con links 404 a eventos eliminados.
const drizzleMocks = vi.hoisted(() => ({
  eq: vi.fn((a: any, b: any) => ({ a, b })),
  and: vi.fn((...args: any[]) => args),
  isNull: vi.fn((c: any) => c),
  inArray: vi.fn((col: any, vals: any[]) => ({ col, vals })),
  desc: vi.fn((c: any) => c),
  sql: vi.fn((...args: any[]) => args),
}));

vi.mock('drizzle-orm', () => drizzleMocks);

vi.mock('../config.js', () => ({ config: { NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173' } }));

const queue: any[] = [];
const chains: any[] = [];

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      const idx = chains.length;
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        then: (resolve: (v: any) => void) => resolve(queue[idx] ?? []),
      };
      chains.push(chain);
      return chain;
    }),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  users: { id: 'id', email: 'email', name: 'name', tier: 'tier', createdAt: 'createdAt', emailVerified: 'emailVerified' },
  events: { id: 'id', userId: 'userId', title: 'title', slug: 'slug', createdAt: 'createdAt', isActive: 'isActive', deletedAt: 'deletedAt' },
  gifts: { eventId: 'eventId', isClaimed: 'isClaimed', deletedAt: 'deletedAt' },
  cashFunds: { eventId: 'eventId' },
  emailTracking: { userId: 'userId', type: 'type', sentAt: 'sentAt' },
}));

vi.mock('../services/email.js', () => ({
  sendReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  isEmailConfigured: vi.fn(() => true),
}));

import { processReminders } from '../services/reminder.js';
import { processEmailSequence } from '../services/emailSequence.js';
import { sendReminderEmail } from '../services/email.js';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  drizzleMocks.eq.mockClear();
  drizzleMocks.and.mockClear();
  drizzleMocks.isNull.mockClear();
  drizzleMocks.inArray.mockClear();
  drizzleMocks.desc.mockClear();
  drizzleMocks.sql.mockClear();
  vi.mocked(sendReminderEmail).mockClear();
  queue.length = 0;
  chains.length = 0;
});

describe('processReminders (B1)', () => {
  it('filtra eventos borrados y regalos borrados en la query principal', async () => {
    queue.push(
      [{ id: 'evt-1', userId: 'u1', title: 'Boda', slug: 'boda', userEmail: 'ana@test.com' }],
      [],
    );

    const result = await processReminders();

    expect(result).toEqual({ processed: 1, reminded: 1 });
    expect(sendReminderEmail).toHaveBeenCalledWith('ana@test.com', 'Boda', 'boda', 0);

    const whereArgs = chains[0].where.mock.calls[0][0] as any[];
    expect(whereArgs).toContain('deletedAt');
    expect(drizzleMocks.isNull).toHaveBeenCalledWith('deletedAt');
    expect(JSON.stringify(drizzleMocks.sql.mock.calls)).toContain('IS NULL');
  });

  it('filtra regalos borrados en el conteo de sin apartar', async () => {
    queue.push(
      [{ id: 'evt-1', userId: 'u1', title: 'Boda', slug: 'boda', userEmail: 'ana@test.com' }],
      [{ eventId: 'evt-1', count: 2 }],
    );

    const result = await processReminders();

    expect(result).toEqual({ processed: 1, reminded: 1 });
    expect(sendReminderEmail).toHaveBeenCalledWith('ana@test.com', 'Boda', 'boda', 2);

    const countsWhere = chains[1].where.mock.calls[0][0] as any[];
    expect(countsWhere).toContain('deletedAt');
  });
});

describe('processEmailSequence (B2)', () => {
  const fakeUser = {
    id: 'u1',
    email: 'ana@test.com',
    name: 'Ana',
    tier: 'free',
    createdAt: new Date(Date.now() - 1.5 * DAY_MS),
  };

  it('filtra eventos borrados al seleccionar los eventos del usuario', async () => {
    queue.push(
      [fakeUser],
      [{ id: 'evt-1', userId: 'u1', title: 'Boda', slug: 'boda', createdAt: fakeUser.createdAt }],
      [],
      [],
      [],
      [],
    );

    const result = await processEmailSequence();

    expect(result).toEqual({ processed: 1 });
    expect(sendReminderEmail).toHaveBeenCalledWith('ana@test.com', 'Boda', 'boda', 0);

    const eventsWhere = chains[1].where.mock.calls[0][0] as any[];
    expect(eventsWhere).toContain('deletedAt');
  });

  it('filtra regalos borrados en el conteo de sin apartar', async () => {
    queue.push(
      [fakeUser],
      [{ id: 'evt-1', userId: 'u1', title: 'Boda', slug: 'boda', createdAt: fakeUser.createdAt }],
      [],
      [{ eventId: 'evt-1', count: 3 }],
      [],
      [],
    );

    const result = await processEmailSequence();

    expect(result).toEqual({ processed: 1 });

    const giftsWhere = chains[3].where.mock.calls[0][0] as any[];
    expect(giftsWhere).toContain('deletedAt');
    expect(drizzleMocks.isNull).toHaveBeenCalledWith('deletedAt');
  });
});
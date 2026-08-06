import { describe, it, expect, vi, beforeEach } from 'vitest';

// B9: los claims se cargan SOLO para los gifts de la página actual (IN de ids)
// y sin innerJoin sobre todos los claims del evento.
const drizzleMocks = vi.hoisted(() => ({
  eq: vi.fn((a: any, b: any) => ({ a, b })),
  and: vi.fn((...args: any[]) => args),
  isNull: vi.fn((c: any) => c),
  inArray: vi.fn((col: any, vals: any[]) => ({ col, vals })),
  desc: vi.fn((c: any) => c),
  sql: vi.fn((...args: any[]) => args),
}));

vi.mock('drizzle-orm', () => drizzleMocks);

const queue: any[] = [];
const chains: any[] = [];

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        then: (resolve: (v: any) => void) => resolve(queue.shift() ?? []),
      };
      chains.push(chain);
      return chain;
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  events: {},
  gifts: {},
  photos: {},
  cashFunds: {},
  giftClaims: {},
  users: {},
}));

import { getEvent } from '../services/event-queries.js';

const eventRow = {
  id: 'evt-1', userId: 'user-1', title: 'Mi Evento', eventType: 'BABY_SHOWER',
  hostPhone: null, slug: 'mi-evento', status: 'active', isActive: true,
  eventDate: new Date(), eventLocation: null, eventNote: null, viewCount: 0,
  frozenAt: null, createdAt: new Date(), updatedAt: new Date(),
};

const giftRows = [
  { id: 'g-1', eventId: 'evt-1', name: 'Olla', createdAt: new Date('2025-01-02T00:00:00Z') },
  { id: 'g-2', eventId: 'evt-1', name: 'Cobija', createdAt: new Date('2025-01-01T00:00:00Z') },
];

const photoRows = [{ id: 'p-1', eventId: 'evt-1', url: 'https://cdn.test/p.jpg' }];

const claimRows = [
  { id: 'c-1', giftId: 'g-1', claimedBy: 'Ana', message: 'Feliz evento', createdAt: new Date('2025-01-03T00:00:00Z') },
  { id: 'c-2', giftId: 'g-2', claimedBy: 'Luis', message: null, createdAt: new Date('2025-01-03T01:00:00Z') },
];

beforeEach(() => {
  vi.clearAllMocks();
  queue.length = 0;
  chains.length = 0;
});

describe('getEvent (B9)', () => {
  it('carga claims solo de los gifts de la página (IN de ids), sin innerJoin', async () => {
    queue.push([eventRow], giftRows, photoRows, claimRows);

    const result = await getEvent('evt-1', 'user-1');

    expect(result.gifts).toHaveLength(2);
    expect(result.gifts[0].claims).toEqual([
      { id: 'c-1', giftId: 'g-1', claimedBy: 'Ana', message: 'Feliz evento', createdAt: claimRows[0].createdAt },
    ]);
    expect(result.gifts[1].claims).toEqual([
      { id: 'c-2', giftId: 'g-2', claimedBy: 'Luis', message: null, createdAt: claimRows[1].createdAt },
    ]);
    expect(result.photos).toHaveLength(1);

    // El query de claims filtra por los ids de la página (no innerJoin global)
    expect(drizzleMocks.inArray).toHaveBeenCalledTimes(1);
    expect(drizzleMocks.inArray.mock.calls[0][1]).toEqual(['g-1', 'g-2']);
    for (const chain of chains) {
      expect(chain.innerJoin).not.toHaveBeenCalled();
    }
  });

  it('no consulta claims si la página de regalos está vacía', async () => {
    queue.push([eventRow], [], photoRows);

    const result = await getEvent('evt-1', 'user-1');

    expect(result.gifts).toHaveLength(0);
    expect(drizzleMocks.inArray).not.toHaveBeenCalled();
    // select: evento + gifts + photos (sin claims)
    expect(chains).toHaveLength(3);
  });

  it('lanza NotFound si el evento no existe', async () => {
    queue.push([]);

    await expect(getEvent('evt-1', 'user-1')).rejects.toThrow('Evento no encontrado');
  });

  it('lanza Forbidden si el evento no pertenece al usuario', async () => {
    queue.push([eventRow], giftRows, photoRows, claimRows);

    await expect(getEvent('evt-1', 'otro-user')).rejects.toThrow('No tienes permiso para ver este evento');
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, isNull } from 'drizzle-orm';
import { db, createTestUser, createTestEvent, cleanDatabase, closeConnection } from './setup.js';
import { events } from '../../db/schema.js';

describe('Event CRUD (integration)', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await closeConnection();
  });

  it('creates a user and an event, reads back, soft-deletes, and verifies exclusion', async () => {
    const user = await createTestUser();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toMatch(/^integration-test/);

    const evt = await createTestEvent(user.id, {
      title: 'Mi Baby Shower',
      eventType: 'BABY_SHOWER',
      hostPhone: '+54 11 1234-5678',
    });

    expect(evt).toBeDefined();
    expect(evt.id).toBeDefined();
    expect(evt.title).toBe('Mi Baby Shower');
    expect(evt.eventType).toBe('BABY_SHOWER');
    expect(evt.userId).toBe(user.id);
    expect(evt.slug).toBeDefined();
    expect(evt.deletedAt).toBeNull();
    expect(evt.isActive).toBe(true);
    expect(evt.status).toBe('active');

    const [found] = await db
      .select()
      .from(events)
      .where(eq(events.id, evt.id))
      .limit(1);

    expect(found).toBeDefined();
    expect(found!.title).toBe('Mi Baby Shower');
    expect(found!.deletedAt).toBeNull();

    await db
      .update(events)
      .set({ deletedAt: new Date() })
      .where(eq(events.id, evt.id));

    const [afterDelete] = await db
      .select()
      .from(events)
      .where(eq(events.id, evt.id))
      .limit(1);

    expect(afterDelete!.deletedAt).toBeInstanceOf(Date);

    const activeEvents = await db
      .select()
      .from(events)
      .where(isNull(events.deletedAt));

    const softDeleted = activeEvents.find((e) => e.id === evt.id);
    expect(softDeleted).toBeUndefined();
  });

  it('creates multiple events for the same user', async () => {
    const user = await createTestUser();

    await createTestEvent(user.id, {
      title: 'Evento Uno',
      eventType: 'BIRTHDAY',
      slug: `multi-uno-${Date.now()}`,
    });
    await createTestEvent(user.id, {
      title: 'Evento Dos',
      eventType: 'WEDDING',
      slug: `multi-dos-${Date.now()}`,
    });

    const userEvents = await db
      .select()
      .from(events)
      .where(eq(events.userId, user.id));

    expect(userEvents).toHaveLength(2);
    expect(userEvents.map((e) => e.title).sort()).toEqual([
      'Evento Dos',
      'Evento Uno',
    ]);
  });

  it('enforces unique slug constraint', async () => {
    const user = await createTestUser();
    const slug = `unique-slug-test-${Date.now()}`;

    await createTestEvent(user.id, { slug });

    await expect(
      createTestEvent(user.id, { slug }),
    ).rejects.toThrow();
  });
});

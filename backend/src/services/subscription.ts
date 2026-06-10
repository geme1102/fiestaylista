import { eq, lte, and, inArray, sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions as subsTable, users, events } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { TIER_LIMITS } from '../types/index.js';
import type { Tier, SubscriptionStatus } from '../types/index.js';

interface UpsertData {
  mpSubscriptionId: string;
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export async function createOrUpdateSubscription(
  userId: string,
  data: UpsertData,
) {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: subsTable.id })
      .from(subsTable)
      .where(eq(subsTable.userId, userId))
      .for('update')
      .limit(1);

    if (existing) {
      const [sub] = await tx
        .update(subsTable)
        .set({
          mpSubscriptionId: data.mpSubscriptionId,
          tier: data.tier,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subsTable.id, existing.id))
        .returning();

      await tx
        .update(users)
        .set({ tier: data.tier, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return sub;
    }

    const [sub] = await tx
      .insert(subsTable)
      .values({
        userId,
        mpSubscriptionId: data.mpSubscriptionId,
        tier: data.tier,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
      })
      .returning();

    await tx
      .update(users)
      .set({ tier: data.tier, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return sub;
  });
}

async function deactivateExcessEvents(userId: string) {
  const FREE_MAX_EVENTS = TIER_LIMITS.free.maxEvents;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.isActive, true), isNull(events.deletedAt)));

  const activeCount = Number(countResult?.count ?? 0);
  if (activeCount <= FREE_MAX_EVENTS) return;

  const excess = activeCount - FREE_MAX_EVENTS;

  const toDeactivate = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.isActive, true), isNull(events.deletedAt)))
    .orderBy(events.createdAt)
    .limit(excess);

  const ids = toDeactivate.map(e => e.id);
  if (ids.length > 0) {
    await db
      .update(events)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(events.id, ids));
  }
}

export async function getCurrentSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(subsTable)
    .where(eq(subsTable.userId, userId))
    .limit(1);

  return sub || null;
}

export async function cancelSubscription(userId: string) {
  const sub = await db.transaction(async (tx) => {
    const [s] = await tx
      .update(subsTable)
      .set({
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(eq(subsTable.userId, userId))
      .returning();

    if (!s) {
      throw new NotFoundError('Suscripción no encontrada');
    }

    await tx
      .update(users)
      .set({ tier: 'free', updatedAt: new Date() })
      .where(eq(users.id, userId));

    return s;
  });

  await deactivateExcessEvents(userId);

  return sub;
}

export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
) {
  const sub = await db.transaction(async (tx) => {
    const [s] = await tx
      .update(subsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(subsTable.userId, userId))
      .returning();

    if (!s) {
      throw new NotFoundError('Suscripción no encontrada');
    }

    if (status === 'canceled' || status === 'past_due' || status === 'incomplete') {
      await tx
        .update(users)
        .set({ tier: 'free', updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return s;
  });

  if (status === 'canceled' || status === 'past_due' || status === 'incomplete') {
    await deactivateExcessEvents(userId);
  }

  return sub;
}

export async function expireStaleSubscriptions(): Promise<number> {
  const now = new Date();
  const gracePeriodEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const result = await db.transaction(async (tx) => {
    const expired = await tx
      .update(subsTable)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(and(
        lte(subsTable.currentPeriodEnd, gracePeriodEnd),
        eq(subsTable.status, 'active'),
      ))
      .returning({ id: subsTable.id, userId: subsTable.userId });

    const canceledPastPeriod = await tx
      .update(subsTable)
      .set({ tier: 'free', updatedAt: new Date() })
      .where(and(
        lte(subsTable.currentPeriodEnd, gracePeriodEnd),
        eq(subsTable.status, 'canceled'),
        eq(subsTable.tier, 'pro'),
      ))
      .returning({ id: subsTable.id, userId: subsTable.userId });

    const allToDowngrade = [...expired, ...canceledPastPeriod];
    const userIds = allToDowngrade.map(s => s.userId).filter(Boolean);

    if (userIds.length > 0) {
      await tx
        .update(users)
        .set({ tier: 'free', updatedAt: new Date() })
        .where(inArray(users.id, userIds));
    }

    return { count: allToDowngrade.length, userIds };
  });

  for (const uid of result.userIds) {
    await deactivateExcessEvents(uid);
  }

  return result.count;
}

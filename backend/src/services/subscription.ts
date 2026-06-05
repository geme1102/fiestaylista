import { eq, lte, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions as subsTable, users } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
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

export async function getCurrentSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(subsTable)
    .where(eq(subsTable.userId, userId))
    .limit(1);

  return sub || null;
}

export async function cancelSubscription(userId: string) {
  return await db.transaction(async (tx) => {
    const [sub] = await tx
      .update(subsTable)
      .set({
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(eq(subsTable.userId, userId))
      .returning();

    if (!sub) {
      throw new NotFoundError('Suscripción no encontrada');
    }

    return sub;
  });
}

export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
) {
  return await db.transaction(async (tx) => {
    const [sub] = await tx
      .update(subsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(subsTable.userId, userId))
      .returning();

    if (!sub) {
      throw new NotFoundError('Suscripción no encontrada');
    }

    if (status === 'canceled' || status === 'past_due' || status === 'incomplete') {
      await tx
        .update(users)
        .set({ tier: 'free', updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return sub;
  });
}

export async function expireStaleSubscriptions(): Promise<number> {
  const now = new Date();
  const gracePeriodEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const expired = await db
    .update(subsTable)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(and(
      lte(subsTable.currentPeriodEnd, gracePeriodEnd),
      eq(subsTable.status, 'active'),
    ))
    .returning({ id: subsTable.id, userId: subsTable.userId });

  const canceledPastPeriod = await db
    .update(subsTable)
    .set({ tier: 'free', updatedAt: new Date() })
    .where(and(
      lte(subsTable.currentPeriodEnd, gracePeriodEnd),
      eq(subsTable.status, 'canceled'),
      eq(subsTable.tier, 'pro'),
    ))
    .returning({ id: subsTable.id, userId: subsTable.userId });

  const allToDowngrade = [...expired, ...canceledPastPeriod];

  for (const sub of allToDowngrade) {
    try {
      await db
        .update(users)
        .set({ tier: 'free', updatedAt: new Date() })
        .where(eq(users.id, sub.userId));
    } catch (err) {
      console.error(`[Subscriptions] Error downgrading user ${sub.userId}:`, err);
    }
  }

  return allToDowngrade.length;
}

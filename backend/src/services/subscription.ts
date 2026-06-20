import { eq, lte, and, inArray, sql, isNull, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions as subsTable, users, events, gifts, photos } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { TIER_LIMITS } from '../types/index.js';
import type { Tier, SubscriptionStatus } from '../types/index.js';

interface UpsertData {
  mpSubscriptionId: string | null;
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export async function createOrUpdateSubscription(
  userId: string,
  data: UpsertData,
  tx?: any,
) {
  const conn = tx || db;
  const [sub] = await conn
    .insert(subsTable)
    .values({
      userId,
      mpSubscriptionId: data.mpSubscriptionId,
      tier: data.tier,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
    })
    .onConflictDoUpdate({
      target: subsTable.userId,
      set: {
        mpSubscriptionId: data.mpSubscriptionId,
        tier: data.tier,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        updatedAt: new Date(),
      },
    })
    .returning();

  await conn
    .update(users)
    .set({ tier: data.tier, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return sub;
}

async function deactivateExcessEvents(userId: string) {
  const FREE_MAX_EVENTS = TIER_LIMITS.free.maxEvents;
  const FREE_MAX_GIFTS = TIER_LIMITS.free.maxGiftsPerEvent;
  const FREE_MAX_PHOTOS = TIER_LIMITS.free.maxPhotosPerEvent;

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

  // Trim excess gifts and photos in remaining active events
  const remainingEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.isActive, true), isNull(events.deletedAt)));

  for (const ev of remainingEvents) {
    const [giftCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gifts)
      .where(and(eq(gifts.eventId, ev.id), isNull(gifts.deletedAt)));

    const giftCount = Number(giftCountResult?.count ?? 0);
    if (giftCount > FREE_MAX_GIFTS) {
      const giftExcess = giftCount - FREE_MAX_GIFTS;
      const toDelete = await db
        .select({ id: gifts.id })
        .from(gifts)
        .where(and(eq(gifts.eventId, ev.id), isNull(gifts.deletedAt)))
        .orderBy(asc(gifts.createdAt))
        .limit(giftExcess);

      const giftIds = toDelete.map(g => g.id);
      if (giftIds.length > 0) {
        await db
          .update(gifts)
          .set({ deletedAt: new Date() })
          .where(inArray(gifts.id, giftIds));
      }
    }

    const [photoCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(and(eq(photos.eventId, ev.id)));

    const photoCount = Number(photoCountResult?.count ?? 0);
    if (photoCount > FREE_MAX_PHOTOS) {
      const photoExcess = photoCount - FREE_MAX_PHOTOS;
      const toDelete = await db
        .select({ id: photos.id })
        .from(photos)
        .where(eq(photos.eventId, ev.id))
        .orderBy(asc(photos.createdAt))
        .limit(photoExcess);

      const photoIds = toDelete.map(p => p.id);
      if (photoIds.length > 0) {
        await db.delete(photos).where(inArray(photos.id, photoIds));
      }
    }
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

export async function cancelSubscription(userId: string, immediate = false) {
  const sub = await db.transaction(async (tx) => {
    const [s] = immediate
      ? await tx.update(subsTable).set({ status: 'canceled', tier: 'free', updatedAt: new Date() }).where(eq(subsTable.userId, userId)).returning()
      : await tx.update(subsTable).set({ status: 'canceled', updatedAt: new Date() }).where(eq(subsTable.userId, userId)).returning();

    if (!s) {
      throw new NotFoundError('Suscripción no encontrada');
    }

    if (immediate) {
      await tx
        .update(users)
        .set({ tier: 'free', updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return s;
  });

  if (immediate) {
    try {
      await deactivateExcessEvents(userId);
    } catch (err) {
      console.error(`[Subscription] Error desactivando eventos tras cancelación para ${userId}:`, err);
    }
  }

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

    if (status === 'incomplete') {
      await tx
        .update(users)
        .set({ tier: 'free', updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return s;
  });

  if (status === 'incomplete') {
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

    const pastDueExpired = await tx
      .update(subsTable)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(and(
        lte(subsTable.currentPeriodEnd, gracePeriodEnd),
        eq(subsTable.status, 'past_due'),
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

    const allToDowngrade = [...expired, ...pastDueExpired, ...canceledPastPeriod];
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

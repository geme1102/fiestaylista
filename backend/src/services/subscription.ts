import { eq, lte, and, inArray, sql, isNull, desc } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../db/index.js';
import { subscriptions as subsTable, users, events, photos, proPayments, emailTracking } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { getPublicIdFromUrl } from '../utils/cloudinary.js';
import { sendFreezeEmail, sendPurgeWarningEmail } from './email.js';
import { config } from '../config.js';
import type { Tier, SubscriptionStatus } from '../types/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Subscription');

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
  tx?: typeof db,
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

  if (data.status === 'active') {
    const now = new Date();
    await conn
      .update(events)
      .set({ isActive: true, frozenAt: null, updatedAt: now })
      .where(and(eq(events.userId, userId), sql`${events.frozenAt} IS NOT NULL`, isNull(events.deletedAt)));
  }

  return sub;
}

async function freezeUserEvents(userId: string, txClient?: typeof db) {
  const conn = txClient || db;
  const now = new Date();
  await conn
    .update(events)
    .set({ isActive: false, frozenAt: now, updatedAt: now })
    .where(and(eq(events.userId, userId), eq(events.isActive, true), isNull(events.deletedAt)));

  log.info({ userId }, 'Eventos congelados');

  // Send freeze notification email (fire-and-forget)
  const [user] = await conn
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.email) {
    sendFreezeEmail(user.email, user.name, `${config.FRONTEND_URL}/pricing`).catch((err: Error) => {
      log.error({ err, userId }, 'Error enviando email de congelamiento:');
    });
  }
}

async function batchFreezeEvents(userIds: string[], txClient?: typeof db) {
  const conn = txClient || db;
  const now = new Date();
  await conn
    .update(events)
    .set({ isActive: false, frozenAt: now, updatedAt: now })
    .where(and(inArray(events.userId, userIds), eq(events.isActive, true), isNull(events.deletedAt)));

  const userRows = await conn
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds));

  for (const user of userRows) {
    if (user?.email) {
      sendFreezeEmail(user.email, user.name, `${config.FRONTEND_URL}/pricing`).catch((err: Error) => {
        log.error({ err, userId: user.id }, 'Error enviando email de congelamiento:');
      });
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

      try {
        await freezeUserEvents(userId, tx as unknown as typeof db);
      } catch (err) {
        log.error({ err }, `Error congelando eventos tras cancelación para ${userId}:`);
      }
    }

    return s;
  });

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

      await freezeUserEvents(userId, tx as unknown as typeof db);
    }

    return s;
  });

  return sub;
}

export async function expireStaleSubscriptions(): Promise<number> {
  const now = new Date();
  const freezeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const result = await db.transaction(async (tx) => {
    const toFreeze = await tx
      .update(subsTable)
      .set({ status: 'canceled', tier: 'free', updatedAt: new Date() })
      .where(and(
        lte(subsTable.currentPeriodEnd, freezeThreshold),
        sql`${subsTable.status} IN ('active', 'past_due')`,
      ))
      .returning({ userId: subsTable.userId });

    const userIds = toFreeze.map(s => s.userId).filter(Boolean);

    if (userIds.length > 0) {
      await tx
        .update(users)
        .set({ tier: 'free', updatedAt: new Date() })
        .where(inArray(users.id, userIds));

      await batchFreezeEvents(userIds, tx as unknown as typeof db);
    }

    return userIds.length;
  });

  if (result > 0) {
    log.info({ count: result }, 'Suscripciones expiradas, eventos congelados');
  }

  return result;
}

export async function purgeExpiredData(): Promise<number> {
  const now = new Date();
  const purgeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const expiredEvents = await db
    .select({ id: events.id, userId: events.userId })
    .from(events)
    .where(and(
      sql`${events.frozenAt} IS NOT NULL`,
      lte(events.frozenAt, purgeThreshold),
      sql`${events.deletedAt} IS NULL`,
    ));

  if (expiredEvents.length === 0) return 0;

  const userIds = [...new Set(expiredEvents.map(e => e.userId))];

  const allEventIds = expiredEvents.map(e => e.id);

  const allPhotos = await db
    .select({ url: photos.url, eventId: photos.eventId })
    .from(photos)
    .where(inArray(photos.eventId, allEventIds));

  const photosByEvent = new Map<string, { url: string }[]>();
  for (const p of allPhotos) {
    if (!photosByEvent.has(p.eventId)) photosByEvent.set(p.eventId, []);
    photosByEvent.get(p.eventId)!.push(p);
  }

  await db
    .delete(events)
    .where(inArray(events.id, allEventIds));

  let purged = 0;
  for (const userId of userIds) {
    try {
      const userEventIds = expiredEvents.filter(e => e.userId === userId).map(e => e.id);
      const userPhotos = userEventIds.flatMap(eid => photosByEvent.get(eid) || []);

      for (const photo of userPhotos) {
        const publicId = getPublicIdFromUrl(photo.url);
        if (publicId) {
          cloudinary.uploader.destroy(publicId).catch(() => {});
        }
      }

      log.info({ userId, eventCount: userEventIds.length, photosPurged: userPhotos.length }, 'Eventos expirados purgados');
      purged += userEventIds.length;
    } catch (err) {
      log.error({ err, userId }, 'Error purgando datos de usuario:');
    }
  }

  return purged;
}

export async function sendPurgeWarnings(): Promise<number> {
  const now = new Date();
  const warningStart = new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000);
  const warningEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const toWarn = await db
    .select({ userId: events.userId })
    .from(events)
    .where(and(
      sql`${events.frozenAt} IS NOT NULL`,
      lte(events.frozenAt, warningStart),
      sql`${events.frozenAt} > ${warningEnd}`,
      sql`NOT EXISTS (SELECT 1 FROM ${emailTracking} WHERE ${emailTracking.userId} = ${events.userId} AND ${emailTracking.type} = 'purge_warning' AND ${emailTracking.sentAt} > ${warningStart})`,
    ))
    .groupBy(events.userId);

  if (toWarn.length === 0) return 0;

  const userIds = toWarn.map(w => w.userId);

  const userRows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds));

  const userMap = new Map(userRows.map(u => [u.id, u]));

  const eventRows = await db
    .select({ userId: events.userId, frozenAt: events.frozenAt })
    .from(events)
    .where(and(inArray(events.userId, userIds), sql`${events.frozenAt} IS NOT NULL`));

  const eventMap = new Map<string, Date>();
  for (const e of eventRows) {
    if (!eventMap.has(e.userId)) {
      eventMap.set(e.userId, e.frozenAt ? new Date(e.frozenAt) : warningStart);
    }
  }

  let warned = 0;
  for (const { userId } of toWarn) {
    try {
      const user = userMap.get(userId);
      if (user?.email) {
        const frozenAt = eventMap.get(userId) ?? warningStart;
        const daysUntilPurge = Math.max(1, Math.ceil((30 * 24 * 60 * 60 * 1000 - (now.getTime() - frozenAt.getTime())) / (24 * 60 * 60 * 1000)));
        sendPurgeWarningEmail(user.email, user.name, daysUntilPurge, `${config.FRONTEND_URL}/pricing`).catch((err: Error) => {
          log.error({ err, userId }, 'Error enviando warning de purga:');
        });
        try {
          await db.insert(emailTracking).values({
            userId,
            type: 'purge_warning',
          });
        } catch {
          await db.update(emailTracking)
            .set({ sentAt: new Date() })
            .where(and(eq(emailTracking.userId, userId), eq(emailTracking.type, 'purge_warning')));
        }
        warned++;
      }
    } catch (err) {
      log.error({ err, userId }, 'Error enviando warning de purga:');
    }
  }

  return warned;
}

export async function getPaymentHistory(userId: string) {
  const payments = await db
    .select({
      id: proPayments.id,
      amount: proPayments.amount,
      interval: proPayments.interval,
      status: proPayments.status,
      createdAt: proPayments.createdAt,
    })
    .from(proPayments)
    .where(eq(proPayments.userId, userId))
    .orderBy(desc(proPayments.createdAt))
    .limit(20);

  return payments;
}

import { eq, lte, and, inArray, sql, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions as subsTable, users, events, photos, proPayments, emailTracking } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { getPublicIdFromUrl, isOwnCloudinaryUrl, destroyWithRetry } from '../utils/cloudinary.js';
import { sendFreezeEmail, sendPurgeWarningEmail } from './email.js';
import { config } from '../config.js';
import { TIER_LIMITS, type Tier, type SubscriptionStatus } from '../types/index.js';
import { fetchPreapprovalInfo } from './mercadopago.js';
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
        mpSubscriptionId: sql`COALESCE(${data.mpSubscriptionId}, ${subsTable.mpSubscriptionId})`,
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
    const limits = TIER_LIMITS[data.tier] ?? TIER_LIMITS.free;
    const frozenEventIds = await conn
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.userId, userId), sql`${events.frozenAt} IS NOT NULL`, isNull(events.deletedAt)))
      .orderBy(sql`${events.frozenAt} DESC`)
      .limit(limits.maxEvents);

    if (frozenEventIds.length > 0) {
      await conn
        .update(events)
        .set({ isActive: true, frozenAt: null, updatedAt: now })
        .where(inArray(events.id, frozenEventIds.map(e => e.id)));
    }
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

  // Congelar todos los eventos activos
  await conn
    .update(events)
    .set({ isActive: false, frozenAt: now, updatedAt: now })
    .where(and(inArray(events.userId, userIds), eq(events.isActive, true), isNull(events.deletedAt)));

  // Restaurar hasta maxEvents según el tier actual de cada usuario
  // (tras expireStaleSubscriptions el tier es 'free', maxEvents = 1)
  for (const userId of userIds) {
    const [userRow] = await conn
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const limits = TIER_LIMITS[userRow?.tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free;

    const eventsToKeep = await conn
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.userId, userId), sql`${events.frozenAt} IS NOT NULL`, isNull(events.deletedAt)))
      .orderBy(desc(events.frozenAt))
      .limit(limits.maxEvents);

    if (eventsToKeep.length > 0) {
      await conn
        .update(events)
        .set({ isActive: true, frozenAt: null, updatedAt: now })
        .where(inArray(events.id, eventsToKeep.map(e => e.id)));
    }
  }

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
    .select({
      id: subsTable.id,
      userId: subsTable.userId,
      mpSubscriptionId: subsTable.mpSubscriptionId,
      tier: subsTable.tier,
      status: subsTable.status,
      currentPeriodStart: subsTable.currentPeriodStart,
      currentPeriodEnd: subsTable.currentPeriodEnd,
      createdAt: subsTable.createdAt,
      updatedAt: subsTable.updatedAt,
    })
    .from(subsTable)
    .where(eq(subsTable.userId, userId))
    .limit(1);

  return sub || null;
}

export async function reconcileSubscriptionOnLogin(userId: string): Promise<void> {
  try {
    const sub = await getCurrentSubscription(userId);
    if (!sub || sub.status === 'active' || !sub.mpSubscriptionId) return;

    const mpInfo = await fetchPreapprovalInfo(sub.mpSubscriptionId);
    if (mpInfo.status === 'active' || mpInfo.status === 'authorized') {
      const periodEnd = mpInfo.nextChargeDate ? new Date(mpInfo.nextChargeDate) : null;
      if (periodEnd && periodEnd <= new Date()) {
        log.info({ userId, mpSubscriptionId: sub.mpSubscriptionId }, 'Suscripción con periodo vencido en MP — no se reactiva');
        return;
      }
      const tier = mpInfo.externalReference.startsWith('pro_plus') ? 'pro_plus' : 'pro';
      await createOrUpdateSubscription(userId, {
        mpSubscriptionId: sub.mpSubscriptionId,
        tier,
        status: 'active',
        currentPeriodStart: mpInfo.dateCreated ? new Date(mpInfo.dateCreated) : new Date(),
        currentPeriodEnd: periodEnd || new Date(),
      });
      log.info({ userId }, 'Suscripción reconciliada on-login');
    }
  } catch (err) {
    log.warn({ err, userId }, 'No se pudo reconciliar suscripción on-login');
  }
}

export async function cancelSubscription(userId: string, immediate = false) {
  const sub = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ currentPeriodEnd: subsTable.currentPeriodEnd })
      .from(subsTable)
      .where(eq(subsTable.userId, userId))
      .limit(1);
    if (!existing) throw new NotFoundError('Suscripción no encontrada');

    const periodAlreadyExpired = existing.currentPeriodEnd && existing.currentPeriodEnd <= new Date();
    const effectiveImmediate = immediate || periodAlreadyExpired;

    const [s] = effectiveImmediate
      ? await tx.update(subsTable).set({ status: 'canceled', tier: 'free', updatedAt: new Date() }).where(eq(subsTable.userId, userId)).returning()
      : await tx.update(subsTable).set({ status: 'canceled', updatedAt: new Date() }).where(eq(subsTable.userId, userId)).returning();

    if (effectiveImmediate) {
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
    // Bloquear filas con FOR UPDATE SKIP LOCKED para evitar que dos cron concurrentes
    // procesen las mismas suscripciones
    const staleRows = await tx.execute(sql`
      SELECT id, user_id FROM ${subsTable} 
      WHERE current_period_end <= ${freezeThreshold.toISOString()}::timestamptz 
        AND status IN ('active', 'past_due', 'canceled') 
      FOR UPDATE SKIP LOCKED
    `) as unknown as { id: string; user_id: string }[];

    const userIds: string[] = [];
    const staleIds: string[] = [];
    for (const row of staleRows) {
      const r = row as Record<string, unknown>;
      if (r.user_id) userIds.push(r.user_id as string);
      if (r.id) staleIds.push(r.id as string);
    }

    if (userIds.length === 0) return 0;

    await tx
      .update(subsTable)
      .set({ status: 'canceled', tier: 'free', updatedAt: new Date() })
      .where(inArray(subsTable.id, staleIds));

    await tx
      .update(users)
      .set({ tier: 'free', updatedAt: new Date() })
      .where(inArray(users.id, userIds));

    await batchFreezeEvents(userIds, tx as unknown as typeof db);

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

  interface PurgeRow { id: string; user_id: string }
  const { eventsToPurge, photosByEvent, userIds } = await db.transaction(async (tx) => {
    // Bloquear eventos expirados con SKIP LOCKED para que dos cron no procesen los mismos
    const expired = await tx.execute(sql`
      SELECT id, user_id FROM ${events}
      WHERE frozen_at IS NOT NULL
        AND frozen_at <= ${purgeThreshold.toISOString()}::timestamptz
        AND deleted_at IS NULL
      FOR UPDATE SKIP LOCKED
      LIMIT 50
    `) as unknown as PurgeRow[];

    if (expired.length === 0) return { eventsToPurge: [], photosByEvent: new Map<string, { url: string }[]>(), userIds: [] as string[] };

    const userIds = [...new Set(expired.map(r => r.user_id))];
    const allEventIds = expired.map(r => r.id);

    const allPhotos = await tx
      .select({ url: photos.url, eventId: photos.eventId })
      .from(photos)
      .where(inArray(photos.eventId, allEventIds));

    const photosByEvent = new Map<string, { url: string }[]>();
    for (const p of allPhotos) {
      if (!photosByEvent.has(p.eventId)) photosByEvent.set(p.eventId, []);
      photosByEvent.get(p.eventId)!.push(p);
    }

    await tx.delete(events).where(inArray(events.id, allEventIds));

    return { eventsToPurge: expired as PurgeRow[], photosByEvent, userIds };
  });

  if (eventsToPurge.length === 0) return 0;

  // Cloudinary cleanup fuera de la transacción (no se puede hacer rollback)
  let purged = 0;
  for (const userId of userIds) {
    try {
      const userEventIds = eventsToPurge.filter(e => e.user_id === userId).map(e => e.id);
      const userPhotos = userEventIds.flatMap(eid => photosByEvent.get(eid) || []);

      const toDestroy = userPhotos
        .filter(p => isOwnCloudinaryUrl(p.url))
        .map(p => getPublicIdFromUrl(p.url))
        .filter((pid): pid is string => pid !== null);

      const CONCURRENCY = 5;
      for (let i = 0; i < toDestroy.length; i += CONCURRENCY) {
        const batch = toDestroy.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(pid => destroyWithRetry(pid)));
        const failed = results.filter(r => !r).length;
        if (failed > 0) {
          log.error({ failed, total: batch.length, userId }, 'Error eliminando fotos de Cloudinary durante purga:');
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
      sql`${events.frozenAt} > ${warningEnd.toISOString()}::timestamptz`,
      sql`NOT EXISTS (SELECT 1 FROM ${emailTracking} WHERE ${emailTracking.userId} = ${events.userId} AND ${emailTracking.type} = 'purge_warning' AND ${emailTracking.sentAt} > ${warningStart.toISOString()}::timestamptz)`,
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
        try {
          await sendPurgeWarningEmail(user.email, user.name, daysUntilPurge, `${config.FRONTEND_URL}/pricing`);
          try {
            await db.insert(emailTracking).values({ userId, type: 'purge_warning' });
          } catch {
            await db.update(emailTracking)
              .set({ sentAt: new Date() })
              .where(and(eq(emailTracking.userId, userId), eq(emailTracking.type, 'purge_warning')));
          }
          warned++;
        } catch (err) {
          log.error({ err, userId }, 'Error enviando warning de purga:');
        }
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

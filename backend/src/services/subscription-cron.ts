import { eq, and, lte, inArray, sql, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions as subsTable, users, events, photos, emailTracking, pendingMpCancellations, pendingCloudinaryDeletes } from '../db/schema.js';
import { getPublicIdFromUrl, isOwnCloudinaryUrl, destroyWithRetry } from '../utils/cloudinary.js';
import { sendFreezeEmail, sendPurgeWarningEmail } from './email.js';
import { config } from '../config.js';
import { TIER_LIMITS } from '../types/index.js';
import { fetchPreapprovalInfo, cancelPreapproval, retryable } from './mercadopago.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('SubscriptionCron');

// H2: reintentar la cancelación en MP de suscripciones con intención de
// cancelación pendiente (cancel_requested_at seteado). Corre en cron con lock.
export async function retryPendingCancellations(): Promise<number> {
  const pending = await db
    .select({ id: subsTable.id, userId: subsTable.userId, mpSubscriptionId: subsTable.mpSubscriptionId })
    .from(subsTable)
    .where(and(
      eq(subsTable.status, 'canceled'),
      sql`${subsTable.cancelRequestedAt} IS NOT NULL`,
      sql`${subsTable.mpSubscriptionId} IS NOT NULL`,
    ))
    .limit(20);

  let resolved = 0;
  for (const sub of pending) {
    const mpId = sub.mpSubscriptionId!;
    try {
      const mpInfo = await fetchPreapprovalInfo(mpId);
      const stillCharging = mpInfo.status === 'active' || mpInfo.status === 'authorized' || mpInfo.status === 'pending';
      if (stillCharging) {
        await retryableCancelPreapproval(mpId);
        log.info({ userId: sub.userId, mpSubscriptionId: mpId }, 'Preapproval cancelado por reintento de cancelación pendiente');
      } else {
        log.info({ userId: sub.userId, mpSubscriptionId: mpId, status: mpInfo.status }, 'Preapproval ya no está cobrando — cancelación confirmada');
      }
      await db
        .update(subsTable)
        .set({ cancelRequestedAt: null, updatedAt: new Date() })
        .where(eq(subsTable.id, sub.id));
      resolved++;
    } catch (err) {
      log.warn({ err, userId: sub.userId, mpSubscriptionId: mpId }, 'Reintento de cancelación pendiente falló — se intentará de nuevo');
    }
  }

  if (pending.length > 0) {
    log.info({ total: pending.length, resolved }, 'Cancelaciones pendientes procesadas');
  }
  return resolved;
}

function retryableCancelPreapproval(preapprovalId: string): Promise<void> {
  return retryable(() => cancelPreapproval(preapprovalId), 3, 10000);
}

// C2: reintentar la cancelación en MP de preapprovals registrados tras la
// eliminación de una cuenta. La fila de subscriptions se borra por cascade del
// DELETE users, así que la intención vive en pending_mp_cancellations (sin FK).
// Solo cancela si MP confirma que el preapproval sigue cobrando; si el intento
// falla, el backoff exponencial lo reintenta en la siguiente corrida.
export async function retryPendingMpCancellations(): Promise<number> {
  const pending = await db
    .select()
    .from(pendingMpCancellations)
    .where(sql`${pendingMpCancellations.nextRetryAt} IS NULL OR ${pendingMpCancellations.nextRetryAt} <= NOW()`)
    .limit(20);

  let resolved = 0;
  for (const pendingCancel of pending) {
    try {
      const mpInfo = await fetchPreapprovalInfo(pendingCancel.mpSubscriptionId);
      const stillCharging = mpInfo.status === 'active' || mpInfo.status === 'authorized' || mpInfo.status === 'pending' || mpInfo.status === 'past_due';
      if (stillCharging) {
        await retryableCancelPreapproval(pendingCancel.mpSubscriptionId);
      } else {
        log.info({ userId: pendingCancel.userId, mpSubscriptionId: pendingCancel.mpSubscriptionId, status: mpInfo.status }, 'Preapproval ya no está cobrando — cancelación pendiente resuelta');
      }
      await db
        .delete(pendingMpCancellations)
        .where(eq(pendingMpCancellations.id, pendingCancel.id));
      resolved++;
    } catch (err) {
      const backoffMinutes = Math.pow(2, Math.min(pendingCancel.attempts + 1, 6));
      await db
        .update(pendingMpCancellations)
        .set({
          attempts: pendingCancel.attempts + 1,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
        })
        .where(eq(pendingMpCancellations.id, pendingCancel.id));
      log.warn({ err, userId: pendingCancel.userId, mpSubscriptionId: pendingCancel.mpSubscriptionId }, 'Reintento de cancelación MP pendiente falló — se intentará de nuevo');
    }
    await new Promise(resolve => setImmediate(resolve));
  }

  if (pending.length > 0) {
    log.info({ total: pending.length, resolved }, 'Cancelaciones MP pendientes procesadas');
  }
  return resolved;
}

// F5: borrar assets de Cloudinary encolados durante la eliminación de una
// cuenta. La ruta respondía en 30-50s haciendo el cleanup inline (timeout del
// cliente de 10s → falsos errores), así que ahora la intención vive en
// pending_cloudinary_deletes (sin FK a users, sobrevive al DELETE). Se procesa
// con el mismo backoff exponencial que retryPendingMpCancellations.
export async function retryPendingCloudinaryDeletes(): Promise<number> {
  const pending = await db
    .select()
    .from(pendingCloudinaryDeletes)
    .where(sql`${pendingCloudinaryDeletes.nextRetryAt} IS NULL OR ${pendingCloudinaryDeletes.nextRetryAt} <= NOW()`)
    .limit(20);

  let resolved = 0;
  for (const pendingDelete of pending) {
    try {
      const deleted = await destroyWithRetry(pendingDelete.publicId);
      if (deleted) {
        await db
          .delete(pendingCloudinaryDeletes)
          .where(eq(pendingCloudinaryDeletes.id, pendingDelete.id));
        resolved++;
      } else {
        throw new Error('Cloudinary no confirmó el borrado');
      }
    } catch (err) {
      const backoffMinutes = Math.pow(2, Math.min(pendingDelete.attempts + 1, 6));
      await db
        .update(pendingCloudinaryDeletes)
        .set({
          attempts: pendingDelete.attempts + 1,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
        })
        .where(eq(pendingCloudinaryDeletes.id, pendingDelete.id));
      log.warn({ err, userId: pendingDelete.userId, publicId: pendingDelete.publicId }, 'Borrado Cloudinary pendiente falló — se intentará de nuevo');
    }
    await new Promise(resolve => setImmediate(resolve));
  }

  if (pending.length > 0) {
    log.info({ total: pending.length, resolved }, 'Borrados Cloudinary pendientes procesados');
  }
  return resolved;
}

export async function expireStaleSubscriptions(): Promise<number> {
  const now = new Date();
  const freezeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  // A1: un pending_approval cuyo cobro nunca se completó expira a los 10 días —
  // antes quedaba en estado pendiente indefinidamente (y con el tier ya otorgado).
  const pendingThreshold = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const result = await db.transaction(async (tx) => {
    // M6: filas 'incomplete' huérfanas (nunca otorgaron beneficios) expiran igual:
    // solo se marcan canceladas sin congelar eventos ni enviar emails (nunca fueron pro).
    const incompleteRows = await tx.execute(sql`
      SELECT id FROM ${subsTable}
      WHERE status = 'incomplete' AND created_at <= ${pendingThreshold.toISOString()}::timestamptz
      FOR UPDATE SKIP LOCKED
    `) as unknown as { id: string }[];

    const incompleteIds = (incompleteRows as unknown as Record<string, unknown>[])
      .map((r: Record<string, unknown>) => r.id as string)
      .filter(Boolean);

    if (incompleteIds.length > 0) {
      await tx
        .update(subsTable)
        .set({ status: 'canceled', tier: 'free', cancelRequestedAt: now, updatedAt: now })
        .where(inArray(subsTable.id, incompleteIds));
    }

    // Bloquear filas con FOR UPDATE SKIP LOCKED para evitar que dos cron concurrentes
    // procesen las mismas suscripciones
    const staleRows = await tx.execute(sql`
      SELECT id, user_id FROM ${subsTable} 
      WHERE (
          (status IN ('active', 'past_due', 'canceled') AND current_period_end <= ${freezeThreshold.toISOString()}::timestamptz)
          OR (status = 'pending_approval' AND current_period_end <= ${pendingThreshold.toISOString()}::timestamptz)
        )
        AND NOT (status = 'canceled' AND tier = 'free')
      FOR UPDATE SKIP LOCKED
    `) as unknown as { id: string; user_id: string }[];

    const userIds: string[] = [];
    const staleIds: string[] = [];
    for (const row of staleRows) {
      const r = row as Record<string, unknown>;
      if (r.user_id) userIds.push(r.user_id as string);
      if (r.id) staleIds.push(r.id as string);
    }

    if (userIds.length === 0) return incompleteIds.length;

    await tx
      .update(subsTable)
      .set({ status: 'canceled', tier: 'free', cancelRequestedAt: now, updatedAt: now })
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

async function batchFreezeEvents(userIds: string[], txClient?: typeof db) {
  const conn = txClient || db;
  const now = new Date();

  // Congelar todos los eventos activos
  await conn
    .update(events)
    .set({ isActive: false, frozenAt: now, updatedAt: now })
    .where(and(inArray(events.userId, userIds), eq(events.isActive, true), isNull(events.deletedAt)));

  // Restaurar hasta maxEvents según el tier actual de cada usuario
  // (tras expireStaleSubscriptions el tier es 'free', maxEvents = 1).
  // D1: solo se restauran eventos congelados EN ESTA corrida (frozenAt = now) —
  // si se restauraran los de corridas anteriores, el evento "kept" reseteaba
  // su frozenAt diario y nunca entraba en la ventana de purge (flip-flop).
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
      .where(and(
        eq(events.userId, userId),
        sql`${events.frozenAt} IS NOT NULL`,
        sql`${events.frozenAt} >= ${now.toISOString()}::timestamptz`,
        isNull(events.deletedAt),
      ))
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
      // D1: dedupe por email_tracking — el email de congelación solo se envía
      // una vez por usuario (mismo patrón que sendPurgeWarnings).
      try {
        await sendFreezeEmail(user.email, user.name, `${config.FRONTEND_URL}/pricing`);
        try {
          await conn.insert(emailTracking).values({ userId: user.id, type: 'freeze' });
        } catch {
          await conn.update(emailTracking)
            .set({ sentAt: new Date() })
            .where(and(eq(emailTracking.userId, user.id), eq(emailTracking.type, 'freeze')));
        }
      } catch (err) {
        log.error({ err, userId: user.id }, 'Error enviando email de congelamiento:');
      }
    }
  }
}

import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, events, gifts, photos, cashFunds, cashContributions, subscriptions, consentRecords, arcoRequests, refreshTokens, pendingMpCancellations, pendingCloudinaryDeletes } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { getPublicIdFromUrl, isOwnCloudinaryUrl } from '../utils/cloudinary.js';
import { cancelPreapproval, searchPreapprovalsByRefAll, retryable } from './mercadopago.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('ARCO');

export async function getUserData(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new NotFoundError('Usuario no encontrado');

  const userEvents = await db
    .select()
    .from(events)
    .where(eq(events.userId, userId));

  const eventIds = userEvents.map(e => e.id);

  const [userGifts, userPhotos, userCashFunds, userSubscription, userConsents, userArcoRequests] = await Promise.all([
    eventIds.length > 0
      ? db.select().from(gifts).where(inArray(gifts.eventId, eventIds))
      : Promise.resolve([]),
    eventIds.length > 0
      ? db.select().from(photos).where(inArray(photos.eventId, eventIds))
      : Promise.resolve([]),
    eventIds.length > 0
      ? db.select().from(cashFunds).where(inArray(cashFunds.eventId, eventIds))
      : Promise.resolve([]),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)
      .then(r => r[0] ?? null),
    db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.userId, userId)),
    db
      .select()
      .from(arcoRequests)
      .where(eq(arcoRequests.userId, userId)),
  ]);

  const cashFundIds = userCashFunds.map(cf => cf.id);
  const userContributions = cashFundIds.length > 0
    ? await db.select().from(cashContributions).where(inArray(cashContributions.cashFundId, cashFundIds))
    : [];

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
    events: userEvents,
    gifts: userGifts,
    photos: userPhotos,
    cashFunds: userCashFunds,
    contributions: userContributions,
    subscription: userSubscription,
    consentHistory: userConsents,
    arcoRequests: userArcoRequests,
  };
}

export async function deleteUserAccount(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new NotFoundError('Usuario no encontrado');

  // C2: recoger TODOS los preapprovals que puedan seguir cobrando (active,
  // past_due, pending_approval, o cancelación MP aún pendiente) — antes solo se
  // cancelaba la sub 'active': past_due/pending_approval seguían cobrando para
  // siempre tras eliminar la cuenta.
  const userSubs = await db
    .select({ mpSubscriptionId: subscriptions.mpSubscriptionId, status: subscriptions.status, cancelRequestedAt: subscriptions.cancelRequestedAt })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  const mpSubscriptionIdsToCancel = new Set<string>();
  for (const sub of userSubs) {
    // canceled sin intención pendiente = MP ya confirmó la cancelación
    if (sub.status === 'canceled' && !sub.cancelRequestedAt) continue;
    if (sub.status === 'incomplete') continue;
    if (sub.mpSubscriptionId) mpSubscriptionIdsToCancel.add(sub.mpSubscriptionId);
  }

  // C2 fallback: preapprovals no vinculados a la sub (ref desactualizada,
  // creados antes de guardar mpSubscriptionId, u huérfanos) — buscarlos en MP
  // por external_reference en TODOS los estados para no dejar ninguno cobrando.
  const tiers = ['pro', 'pro_plus'] as const;
  const intervals = ['month', 'year'] as const;
  const refs = tiers.flatMap(t => intervals.map(i => `${t}_${userId}_${i}`));
  const foundByRef = await Promise.all(refs.map(ref => searchPreapprovalsByRefAll(ref)));
  for (const found of foundByRef.flat()) {
    if (found.id) mpSubscriptionIdsToCancel.add(found.id);
  }

  // D5: recolectar assets externos ANTES del borrado en DB
  const userEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.userId, userId));

  const eventIds = userEvents.map(e => e.id);
  let cloudinaryDeletes: string[] = [];
  if (eventIds.length > 0) {
    const userPhotos = await db
      .select({ url: photos.url })
      .from(photos)
      .where(inArray(photos.eventId, eventIds));

    cloudinaryDeletes = userPhotos
      .filter(p => isOwnCloudinaryUrl(p.url))
      .map(p => getPublicIdFromUrl(p.url))
      .filter(Boolean) as string[];
  }

  // 1) Borrado en DB PRIMERO: si falla, la cuenta queda intacta y los
  //    assets externos nunca se tocan. El DELETE del user hace cascade
  //    a events → gifts/photos/cashFunds/guests/messages.
  await db.transaction(async (tx) => {
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });

  // 2) Cancelación MP best-effort con reintento persistente (no bloquea la
  //    eliminación). Si un intento falla, la intención se registra en
  //    pending_mp_cancellations y el cron retryPendingMpCancellations la
  //    reintenta (con backoff) hasta que MP confirme la cancelación.
  for (const mpId of mpSubscriptionIdsToCancel) {
    try {
      await retryable(() => cancelPreapproval(mpId), 3, 10000);
      log.info({ mpSubscriptionId: mpId, userId }, 'Preapproval cancelado en MP');
    } catch (err) {
      log.error({ err, mpSubscriptionId: mpId, userId }, 'Error cancelando preapproval en MP — queda pendiente de reintento');
      try {
        await db.insert(pendingMpCancellations).values({ userId, mpSubscriptionId: mpId }).onConflictDoNothing();
      } catch (insertErr) {
        log.error({ err: insertErr, mpSubscriptionId: mpId }, 'Error registrando cancelación MP pendiente');
      }
    }
  }

  // 3) Cloudinary en BACKGROUND con reintento persistente: F5 — el borrado
  //    inline hacía que el endpoint respondiera en 30-50s (timeout del cliente
  //    de 10s → falsos errores de "eliminación fallida"). Ahora los public_ids
  //    se encolan en pending_cloudinary_deletes y el cron
  //    retryPendingCloudinaryDeletes los borra con backoff. Best-effort: si el
  //    insert falla quedan huérfanos (aceptado, mismo compromiso que antes).
  if (cloudinaryDeletes.length > 0) {
    try {
      await db
        .insert(pendingCloudinaryDeletes)
        .values(cloudinaryDeletes.map(publicId => ({ userId, publicId })))
        .onConflictDoNothing();
      log.info({ count: cloudinaryDeletes.length, userId }, 'Borrados de Cloudinary encolados para procesamiento en background');
    } catch (err) {
      log.error({ err, count: cloudinaryDeletes.length, userId }, 'Error encolando borrados de Cloudinary — algunos assets pueden quedar huérfanos');
    }
  }
}

export async function createArcoRequest(
  userId: string,
  requestType: 'access' | 'rectify' | 'cancel' | 'oppose',
  details?: string,
) {
  const [request] = await db
    .insert(arcoRequests)
    .values({
      userId,
      requestType,
      details,
      status: 'pending',
    })
    .returning();
  return request;
}

export async function getArcoRequests(userId: string) {
  return db
    .select()
    .from(arcoRequests)
    .where(eq(arcoRequests.userId, userId))
    .orderBy(arcoRequests.createdAt);
}

import { eq, and, inArray, sql, isNull, desc, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions as subsTable, users, events, proPayments } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { sendFreezeEmail } from './email.js';
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
        // C1: set directo (sin COALESCE) — un id nulo LIMPIA el preapproval anterior.
        // COALESCE conservaba el id viejo y dejaba la sub apuntando a un preapproval
        // que ya no existe o que fue reemplazado.
        mpSubscriptionId: data.mpSubscriptionId,
        tier: data.tier,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        // H2: reactivación (compra nueva o reconciliación) cancela cualquier
        // intención de cancelación pendiente.
        cancelRequestedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  // A1: un estado 'pending_approval' NO otorga el tier — el usuario solo lo
  // obtiene cuando el primer cobro se confirma (webhook active). Evita el
  // "Pro gratis indefinido" si el cobro nunca se completa.
  if (data.status !== 'pending_approval') {
    await conn
      .update(users)
      .set({ tier: data.tier, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  if (data.status === 'active') {
    const now = new Date();
    const limits = TIER_LIMITS[data.tier] ?? TIER_LIMITS.free;

    // D9: solo descongelar hasta completar el cupo del tier — si el usuario
    // ya tiene eventos activos (reactivación tras bajar de tier), no exceder maxEvents.
    const [activeRow] = await conn
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.isActive, true), isNull(events.deletedAt)));
    const activeCount = Number(activeRow?.count ?? 0);

    // A5: si el usuario compró un tier MENOR (downgrade pro_plus → pro), congelar
    // el exceso de eventos activos, manteniendo los más recientes. Los eventos se
    // congelan en orden ASC (los MÁS VIEJOS primero) para que el "kept" del free
    // (frozenAt DESC) coincida con el mismo criterio de frescura.
    if (activeCount > limits.maxEvents) {
      const excess = activeCount - limits.maxEvents;
      const excessEvents = await conn
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.userId, userId), eq(events.isActive, true), isNull(events.deletedAt)))
        .orderBy(asc(events.updatedAt))
        .limit(excess);
      if (excessEvents.length > 0) {
        await conn
          .update(events)
          .set({ isActive: false, frozenAt: now, updatedAt: now })
          .where(inArray(events.id, excessEvents.map(e => e.id)));
        log.info({ userId, frozen: excessEvents.length, tier: data.tier }, 'Eventos congelados por downgrade de tier');
      }
    }

    const slots = Math.max(0, limits.maxEvents - activeCount);
    if (slots <= 0) return sub;

    const frozenEventIds = await conn
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.userId, userId), sql`${events.frozenAt} IS NOT NULL`, isNull(events.deletedAt)))
      .orderBy(sql`${events.frozenAt} DESC`)
      .limit(slots);

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

// M3: restaurar el evento "kept" del plan free (1) tras congelar — mismo patrón
// que batchFreezeEvents: solo los congelados EN ESTA corrida (frozenAt = now),
// el más reciente primero. Sin esto, la cancelación inmediata congelaba TODOS
// los eventos mientras el cron sí dejaba 1 activo (inconsistencia).
async function restoreKeptEvents(userId: string, conn: typeof db, now: Date) {
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
    .limit(TIER_LIMITS.free.maxEvents);

  if (eventsToKeep.length > 0) {
    await conn
      .update(events)
      .set({ isActive: true, frozenAt: null, updatedAt: now })
      .where(inArray(events.id, eventsToKeep.map(e => e.id)));
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
      cancelRequestedAt: subsTable.cancelRequestedAt,
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

    // H2: intención de cancelación pendiente — el usuario pidió cancelar y la
    // cancelación en MP aún no se confirma; NO reactivar la suscripción.
    if (sub.cancelRequestedAt) {
      log.info({ userId, mpSubscriptionId: sub.mpSubscriptionId }, 'Suscripción con cancelación pendiente — no se reactiva on-login');
      return;
    }

    const mpInfo = await fetchPreapprovalInfo(sub.mpSubscriptionId);
    // A2: solo un status 'active' confirma que MP sigue cobrando — 'authorized'
    // (cobro inicial aún no confirmado) ya no reactiva la suscripción.
    if (mpInfo.status === 'active') {
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

    // H2: registrar la intención de cancelación (cancel_requested_at). Si la
    // cancelación del preapproval en MP falla, el cron retryPendingCancellations
    // la reintenta, y la reconciliación on-login nunca reactiva la sub.
    const now = new Date();
    const [s] = effectiveImmediate
      ? await tx.update(subsTable).set({ status: 'canceled', tier: 'free', cancelRequestedAt: now, updatedAt: now }).where(eq(subsTable.userId, userId)).returning()
      : await tx.update(subsTable).set({ status: 'canceled', cancelRequestedAt: now, updatedAt: now }).where(eq(subsTable.userId, userId)).returning();

    if (effectiveImmediate) {
      await tx
        .update(users)
        .set({ tier: 'free', updatedAt: now })
        .where(eq(users.id, userId));

      try {
        await freezeUserEvents(userId, tx as unknown as typeof db);

        await restoreKeptEvents(userId, tx as unknown as typeof db, now);
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

      // M6: un cobro incompleto nunca otorgó beneficios — restaurar el evento
      // kept del plan free para no congelar todo (consistencia con cancelación).
      await restoreKeptEvents(userId, tx as unknown as typeof db, new Date());
    }

    return s;
  });

  return sub;
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

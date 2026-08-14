import { eq, and, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users, subscriptions, proPayments, emailTracking, pendingMpCancellations } from '../db/schema.js';
import * as subscriptionService from './subscription.js';
import * as emailService from './email.js';
import { escapeHtml } from '../utils/sanitize.js';
import * as mercadopagoService from './mercadopago.js';
import { fetchPaymentInfo, fetchPreapprovalInfo } from './mercadopago.js';
import { createModuleLogger } from '../utils/logger.js';
import { TIER_ORDER } from '../types/index.js';

const log = createModuleLogger('MP');

// E4: si la cancelación del preapproval reemplazado falla (retryable agotado),
// se encola en pending_mp_cancellations (mismo patrón D3-M1 de delete-account):
// el cron retryPendingMpCancellations lo reintenta con backoff exponencial.
// Antes el catch solo logueaba → el preapproval viejo seguía cobrando para
// siempre y el usuario pagaba dos suscripciones sin saberlo.
async function enqueueMpCancellation(userId: string, mpSubscriptionId: string, reason: string): Promise<void> {
  try {
    await db
      .insert(pendingMpCancellations)
      .values({ userId, mpSubscriptionId })
      .onConflictDoNothing();
    log.info({ userId, mpSubscriptionId, reason }, 'Cancelación MP encolada para reintento en background');
  } catch (err) {
    log.error({ err, userId, mpSubscriptionId }, 'Error encolando cancelación MP — el preapproval puede seguir cobrando');
  }
}

// C1: compara antigüedad de dos preapprovals en MP (por date_created) para
// distinguir un pago/webhook del preapproval REEMPLAZADO (ignorar) de uno de
// una COMPRA NUEVA (upgrade/recompra — procesar). Devuelve true si candidateId
// se creó DESPUÉS que baselineId; null si no se pudo determinar (comportamiento
// conservador: el caller ignora, como el guard original).
async function isPreapprovalNewer(candidateId: string, baselineId: string): Promise<boolean | null> {
  try {
    const [candidate, baseline] = await Promise.all([
      fetchPreapprovalInfo(candidateId),
      fetchPreapprovalInfo(baselineId),
    ]);
    if (!candidate.dateCreated || !baseline.dateCreated) return null;
    const candidateTime = new Date(candidate.dateCreated).getTime();
    const baselineTime = new Date(baseline.dateCreated).getTime();
    if (Number.isNaN(candidateTime) || Number.isNaN(baselineTime)) return null;
    return candidateTime > baselineTime;
  } catch (err) {
    log.warn({ err, candidateId, baselineId }, 'No se pudo comparar antigüedad de preapprovals');
    return null;
  }
}

export async function handleProPayment(paymentId: string, userId: string, interval: string, tier: 'pro' | 'pro_plus', newPreapprovalId?: string | null): Promise<void> {
  const periodDays = interval === 'year' ? 365 : 30;
  const isProPlus = tier === 'pro_plus';
  const expectedAmount = interval === 'year'
    ? (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS * 11 : config.PRO_YEARLY_PRICE_CENTS)
    : (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS : config.PRO_MONTHLY_PRICE_CENTS);

  let oldMpSubscriptionId: string | null = null;
  let oldTier: string | null = null;

  // C1: si el pago no trae preapproval_id, buscarlo por external_reference
  // (patrón ya usado abajo para upgrades sin id). Garantiza que el nuevo
  // preapproval sea la fuente de verdad y el viejo no siga cobrando.
  let effectivePreapprovalId = newPreapprovalId ?? null;
  if (!effectivePreapprovalId) {
    try {
      const found = await mercadopagoService.searchPreapprovalsByRef(`${tier}_${userId}_${interval}`);
      effectivePreapprovalId = found?.id ?? null;
    } catch (err) {
      log.warn({ err, userId }, 'No se pudo buscar el preapproval nuevo por external_reference');
    }
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'payment_' + paymentId}))`);

    const [existingPayment] = await tx
      .select({ id: proPayments.id })
      .from(proPayments)
      .where(eq(proPayments.mpPaymentId, paymentId))
      .limit(1);

    if (existingPayment) {
      log.info(`${tier.toUpperCase()} payment ${paymentId} already processed`);
      return;
    }

    // H3: sin preapproval identificable (ni del pago ni por búsqueda) no se
    // actualiza la suscripción — antes se conservaba el id VIEJO como si fuera
    // el nuevo: el preapproval viejo seguía cobrando y el nuevo (creado por el
    // usuario) quedaba huérfano → doble cobro. Lanzar error lo registra en
    // failedWebhooks y el cron reintenta cuando la búsqueda resuelva.
    if (!effectivePreapprovalId) {
      throw new Error(`No se pudo identificar el preapproval del pago ${paymentId} (ref ${tier}_${userId}_${interval}) — requiere revisión`);
    }

    const currentSub = await tx
      .select({ mpSubscriptionId: subscriptions.mpSubscriptionId, tier: subscriptions.tier, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    const existingId = currentSub[0]?.mpSubscriptionId ?? null;
    const existingStatus = currentSub[0]?.status ?? null;

    // C1 (pago): distinguir el pago de un preapproval REEMPLAZADO (ignorar) del
    // pago de una COMPRA NUEVA más reciente (upgrade/recompra — procesar). La
    // fuente de verdad es el preapproval MÁS NUEVO por date_created: antes se
    // ignoraba CUALQUIER id distinto del activo, por lo que un upgrade con sub
    // activa quedaba sin registrar, el tier nunca subía y MP cobraba ambos
    // preapprovals para siempre.
    if (existingStatus === 'active' && existingId && existingId !== effectivePreapprovalId) {
      const incomingIsNewer = await isPreapprovalNewer(effectivePreapprovalId, existingId);
      if (incomingIsNewer !== true) {
        log.info({ userId, paymentId, current: existingId, incoming: effectivePreapprovalId }, 'Ignorando pago de preapproval reemplazado');
        return;
      }
      log.info({ userId, paymentId, current: existingId, incoming: effectivePreapprovalId }, 'Pago de preapproval más nuevo que el activo — procesando upgrade/recompra');
    }

    // A3 (pago): un pago de un tier menor al activo no debe degradar la sub.
    const currentTierLevel = TIER_ORDER[(currentSub[0]?.tier as keyof typeof TIER_ORDER) ?? 'free'] ?? 0;
    if (existingStatus === 'active' && TIER_ORDER[tier] < currentTierLevel) {
      log.info({ userId, paymentId, detectedTier: tier, currentTier: currentSub[0]?.tier }, 'Ignorando pago de tier menor al activo');
      return;
    }

    // Solo registrar el preapproval anterior si el pago se procesa — así el
    // bloque post-transacción no cancela nada cuando un guard ya ignoró el pago.
    oldMpSubscriptionId = existingId;
    oldTier = currentSub[0]?.tier ?? null;

    // C1: guardar el preapproval NUEVO (no el viejo) para que el webhook del
    // preapproval viejo no sea tratado como "actual" ni lo pisque como duplicado.
    const mpSubscriptionId = effectivePreapprovalId;

    await subscriptionService.createOrUpdateSubscription(userId, {
      mpSubscriptionId,
      tier,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
    }, tx as unknown as typeof db);
    await tx
      .insert(proPayments)
      .values({ userId, mpPaymentId: paymentId, amount: expectedAmount, interval, tier })
      .onConflictDoNothing();
  });

  // C1: cancelar el preapproval anterior SIEMPRE que exista un preapproval nuevo
  // distinto (upgrade, downgrade o recompra en el mismo tier). El viejo quedó
  // huérfano y seguiría cobrando mensualmente en MP.
  if (oldMpSubscriptionId && effectivePreapprovalId && oldMpSubscriptionId !== effectivePreapprovalId) {
    try {
      await mercadopagoService.retryable(
        () => mercadopagoService.cancelPreapproval(oldMpSubscriptionId!),
        3,
        10000,
      );
      log.info({ oldMpSubscriptionId, userId, from: oldTier, to: tier }, 'Preapproval anterior cancelado por reemplazo de suscripción');
    } catch (err) {
      // E4: retryable agotado (~30s de fallos de MP) — encolar para el cron,
      // NO dejar el doble cobro en silencio.
      log.warn({ err, userId, from: oldTier, to: tier }, 'Cancelación inline fallida — encolando preapproval anterior para reintento background');
      await enqueueMpCancellation(userId, oldMpSubscriptionId, 'upgrade-replacement-payment');
    }
  }

  // D2: el emailTracking SOLO se registra si el envío resolvió OK — antes se
  // marcaba como enviado aunque Resend fallara, y el check `existingEmail`
  // bloqueaba cualquier reintento futuro (usuario pagaba y nunca recibía el email).
  try {
    const emailType = isProPlus ? 'pro_plus_confirmation' : 'pro_confirmation';
    const [existingEmail] = await db
      .select({ id: emailTracking.id })
      .from(emailTracking)
      .where(and(eq(emailTracking.userId, userId), eq(emailTracking.type, emailType)))
      .limit(1);
    if (existingEmail) return;

    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return;

    if (isProPlus) {
      const period = interval === 'year' ? 'anual' : 'mensual';
      await emailService.sendEmail({
        from: config.FROM_EMAIL,
        to: user.email,
        subject: 'Bienvenido a Fiesta y Lista Pro Plus',
        emailType: 'pro_plus_confirmation',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <div style="text-align:center;margin-bottom:16px">
              <div style="display:inline-flex;align-items:center;justify-content:center;background:#8b5cf6;width:48px;height:48px;border-radius:12px;color:white;font-size:24px;font-weight:bold;line-height:48px;margin-bottom:4px">F</div>
              <p style="margin:0;color:#1f2937;font-size:18px;font-weight:bold">Fiesta y Lista</p>
            </div>
            <h1 style="text-align:center;color:#1f2937;font-size:20px">Bienvenido a Pro Plus, ${escapeHtml(user.name)}</h1>
            <p style="color:#6b7280;text-align:center;margin:16px 0">Tu suscripción ${period} ya está activa. Ahora tienes acceso a todas las funciones premium con más espacio para tus eventos.</p>
            <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;margin:16px 0">
              <p style="margin:0;color:#5b21b6;font-size:14px"><strong>Qué incluye:</strong></p>
              <ul style="margin:8px 0 0;padding-left:20px;color:#5b21b6;font-size:14px">
                <li>3 eventos</li>
                <li>100 regalos por evento</li>
                <li>20 fotos por evento</li>
                <li>Lluvia de Sobres: tus invitados reportan sus aportes</li>
              </ul>
            </div>
            <div style="text-align:center;margin:24px 0">
              <a href="${config.FRONTEND_URL}/dashboard" style="display:inline-block;padding:12px 32px;background:#8b5cf6;color:white;text-decoration:none;border-radius:12px;font-weight:600">Ir al dashboard</a>
            </div>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
            <p style="color:#9ca3af;font-size:12px;text-align:center">— El equipo de Fiesta y Lista</p>
          </div>
        `,
      });
    } else {
      const periodLabel = interval === 'year' ? 'anual' : 'mensual';
      await emailService.sendProConfirmationEmail(user.email, user.name, periodLabel);
    }

    await db.insert(emailTracking).values({ userId, type: emailType }).onConflictDoNothing();
  } catch (err) {
    log.error({ err }, `Error enviando email de confirmación para ${userId}:`);
  }
}

// A4: true si el pago pertenece al preapproval actual (o no existe uno más nuevo).
// Un refund de un pago antiguo (ya reemplazado por otra compra) no debe cancelar la sub nueva.
async function isPaymentFromCurrentPreapproval(userId: string, preapprovalId: string | null): Promise<boolean> {
  const [currentSub] = await db
    .select({ mpSubscriptionId: subscriptions.mpSubscriptionId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return !currentSub?.mpSubscriptionId || currentSub.mpSubscriptionId === preapprovalId;
}

export async function handlePaymentNotification(paymentId: string): Promise<void> {
  const info = await fetchPaymentInfo(paymentId);
  const ref = info.externalReference;

  if (ref && ref.startsWith('pro_')) {
    // 'pro_plus?' como regex NO matchea refs de Pro (pro_user-1_month) — el
    // grupo (plus_)? captura el prefijo opcional y (.+) el userId.
    const match = ref.match(/^pro_(plus_)?(.+)_(month|year)$/);
    if (!match) return;
    const isProPlus = ref.startsWith('pro_plus_');
    if (info.status === 'approved') {
      const tier = isProPlus ? 'pro_plus' : 'pro';
      const userId = match[2];
      const interval = match[3] as 'month' | 'year';
      const expectedAmount = interval === 'year'
        ? (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS * 11 : config.PRO_YEARLY_PRICE_CENTS)
        : (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS : config.PRO_MONTHLY_PRICE_CENTS);
      const diff = Math.abs(info.transactionAmount - expectedAmount);
      if (diff > 1 && diff / expectedAmount > 0.01) {
        // H1: un pago aprobado con monto inesperado NO se descarta en silencio —
        // el error entra a failedWebhooks y el cron reintenta (dinero cobrado
        // sin tier sería pérdida permanente para el usuario).
        throw new Error(`Monto de ${tier.toUpperCase()} inválido: esperado ${expectedAmount}, recibido ${info.transactionAmount} (pago ${paymentId})`);
      }
      await handleProPayment(paymentId, userId, interval, tier, info.preapprovalId);
    } else if (info.status === 'refunded' || info.status === 'charged_back') {
      const userId = match[2];
      await db
        .update(proPayments)
        .set({ status: 'refunded' })
        .where(eq(proPayments.mpPaymentId, paymentId))
        .catch((err: unknown) => log.error({ err }, 'Error marcando pago como reembolsado:'));
      // A4: solo cancelar si el pago reembolsado pertenece al preapproval ACTUAL
      // (o no existe uno más nuevo) — un refund de un pago antiguo no debe
      // tumbar una suscripción nueva.
      if (userId && (await isPaymentFromCurrentPreapproval(userId, info.preapprovalId))) {
        await subscriptionService.cancelSubscription(userId, true);
      }
    }
    return;
  }

  if (info.status === 'refunded' || info.status === 'charged_back') {
    const [updated] = await db
      .update(proPayments)
      .set({ status: 'refunded' })
      .where(eq(proPayments.mpPaymentId, paymentId))
      .returning({ id: proPayments.id, userId: proPayments.userId, tier: proPayments.tier })
      .catch((err: unknown) => {
        log.error({ err, paymentId }, 'Error marcando pago como reembolsado:');
        return [];
      });
    // Solo cancelar suscripción si este era un pago de suscripción (tier no es null)
    // Y pertenece al preapproval actual (A4).
    if (updated?.userId && updated.tier && (await isPaymentFromCurrentPreapproval(updated.userId, info.preapprovalId))) {
      await subscriptionService.cancelSubscription(updated.userId, true);
    }
    return;
  }

  if (info.status !== 'approved') return;

  // HIGH-1: sin external_reference pro_* el pago no puede identificarse como
  // suscripción nuestra. Antes un fallback por monto otorgaba el tier a pagos
  // ajenos (~1/100 del precio). Todo pago aprobado sin ref válida se rechaza
  // y queda registrado en failedWebhooks para revisión manual.
  throw new Error(`Pago aprobado ${paymentId} sin external_reference pro_* válida (ref: ${ref || 'vacía'}) — requiere revisión manual`);
}

export async function handleSubscriptionNotification(preapprovalId: string): Promise<void> {
  const info = await fetchPreapprovalInfo(preapprovalId);
  let userId: string | null = null;
  let detectedTier: 'pro' | 'pro_plus' | null = null;
  let detectedInterval: 'month' | 'year' = 'month';
  const ref = info.externalReference;

  if (ref && ref.startsWith('pro_')) {
    const match = ref.match(/^pro_(plus_)?(.+)_(month|year)$/);
    if (!match) return;
    const isProPlus = ref.startsWith('pro_plus_');
    userId = match[2];
    detectedTier = isProPlus ? 'pro_plus' : 'pro';
    detectedInterval = match[3] as 'month' | 'year';

    // M7: el monto del preapproval solo se valida cuando MP reporta el cobro
    // inicial (initial_amount). Con solo auto_recurring.transaction_amount el
    // valor es el cobro recurrente (mensual) — para planes anuales no coincide
    // con el precio anual y un webhook legítimo se ignoraba en silencio.
    if (info.amountSource === 'initial') {
      const expectedAmount = detectedInterval === 'year'
        ? (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS * 11 : config.PRO_YEARLY_PRICE_CENTS)
        : (isProPlus ? config.PRO_PLUS_MONTHLY_PRICE_CENTS : config.PRO_MONTHLY_PRICE_CENTS);
      const diff = Math.abs(info.transactionAmount - expectedAmount);
      if (diff > 1 && diff / expectedAmount > 0.01) {
        throw new Error(`Monto de suscripción no coincide con el plan detectado (preapproval ${preapprovalId}): esperado ${expectedAmount}, recibido ${info.transactionAmount}`);
      }
    }
  } else {
    // HIGH-1: preapproval sin external_reference pro_* no es de Fiesta y Lista.
    // Antes se detectaba el tier por monto con el email del pagador (fuga de tier).
    throw new Error(`Preapproval ${preapprovalId} sin external_reference pro_* válida (ref: ${ref || 'vacía'}) — requiere revisión manual`);
  }

  const periodDays = detectedInterval === 'year' ? 365 : 30;

  if (info.status === 'active') {
    // C1: preapproval reemplazado por una compra más reciente (upgrade) — se
    // cancela en MP tras procesar el webhook.
    let replacedMpSubscriptionId: string | null = null;
    const currentSub = await subscriptionService.getCurrentSubscription(userId!);

    if (currentSub && currentSub.status === 'canceled') {
      log.warn({ userId, preapprovalId }, 'Ignorando webhook tardío — suscripción cancelada');
      return;
    }

    if (currentSub && currentSub.status === 'active') {
      // C1: distinguir el webhook de un preapproval REEMPLAZADO (ignorar) del de
      // una COMPRA NUEVA más reciente (upgrade — procesar y cancelar el viejo).
      // La fuente de verdad es el preapproval MÁS NUEVO por date_created.
      if (currentSub.mpSubscriptionId !== preapprovalId) {
        const replacedId = currentSub.mpSubscriptionId;
        if (!replacedId) return;
        const incomingIsNewer = await isPreapprovalNewer(preapprovalId, replacedId);
        if (incomingIsNewer !== true) {
          log.info({ userId, preapprovalId, current: currentSub.mpSubscriptionId }, 'Ignorando webhook de preapproval reemplazado');
          return;
        }
        replacedMpSubscriptionId = replacedId;
        log.info({ userId, preapprovalId, current: currentSub.mpSubscriptionId }, 'Webhook active de preapproval más nuevo que el activo — procesando reemplazo');
      } else {
        // A3: un webhook tardío de un tier menor no debe degradar el tier activo.
        const currentTierLevel = TIER_ORDER[currentSub.tier as keyof typeof TIER_ORDER] ?? 0;
        const detectedLevel = TIER_ORDER[detectedTier!] ?? 0;
        if (detectedLevel < currentTierLevel) {
          log.info({ userId, preapprovalId, detectedTier, currentTier: currentSub.tier }, 'Ignorando webhook de tier menor al activo');
          return;
        }
        log.info({ preapprovalId, userId }, 'Preapproval ya procesado, ignorando webhook duplicado');
        return;
      }
    }

    const currentPeriodEnd = info.nextChargeDate
      ? new Date(info.nextChargeDate)
      : new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
    const currentPeriodStart = info.dateCreated
      ? new Date(info.dateCreated)
      : new Date();

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'preapproval_' + preapprovalId}))`);

      await subscriptionService.createOrUpdateSubscription(userId!, {
        mpSubscriptionId: preapprovalId,
        tier: detectedTier!,
        status: 'active',
        currentPeriodStart,
        currentPeriodEnd,
      }, tx as unknown as typeof db);
    });

    // C1: el preapproval reemplazado quedó huérfano y seguiría cobrando en MP —
    // cancelarlo post-transacción, best-effort (mismo patrón que handleProPayment).
    if (replacedMpSubscriptionId) {
      try {
        await mercadopagoService.retryable(
          () => mercadopagoService.cancelPreapproval(replacedMpSubscriptionId!),
          3,
          10000,
        );
        log.info({ oldMpSubscriptionId: replacedMpSubscriptionId, userId, to: detectedTier }, 'Preapproval reemplazado cancelado por webhook active');
      } catch (err) {
        // E4: retryable agotado — encolar para el cron, NO dejar el doble cobro.
        log.warn({ err, userId }, 'Cancelación inline fallida — encolando preapproval reemplazado para reintento background');
        await enqueueMpCancellation(userId, replacedMpSubscriptionId, 'upgrade-replacement-webhook');
      }
    }
  } else if (info.status === 'authorized') {
    // MEDIUM-2: un authorized tardío NO debe sobreescribir una suscripción
    // activa (antes degradaba a pending_approval y el usuario perdía el servicio
    // habiendo pagado). Solo aplica cuando no hay sub activa.
    const currentSub = await subscriptionService.getCurrentSubscription(userId!);
    if (currentSub && currentSub.status === 'active') {
      if (currentSub.mpSubscriptionId && currentSub.mpSubscriptionId !== preapprovalId) {
        log.info({ userId, preapprovalId, current: currentSub.mpSubscriptionId }, 'Ignorando webhook authorized de preapproval reemplazado');
      } else {
        log.info({ userId, preapprovalId }, 'Ignorando webhook authorized — ya existe suscripción activa');
      }
      return;
    }

    const currentPeriodStart = info.dateCreated
      ? new Date(info.dateCreated)
      : new Date();
    const currentPeriodEnd = info.nextChargeDate
      ? new Date(info.nextChargeDate)
      : new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'preapproval_' + preapprovalId}))`);

      await subscriptionService.createOrUpdateSubscription(userId!, {
        mpSubscriptionId: preapprovalId,
        tier: detectedTier!,
        status: 'pending_approval',
        currentPeriodStart,
        currentPeriodEnd,
      }, tx as unknown as typeof db);
    });
  } else if (info.status === 'cancelled') {
    // C2: solo cancelar si este preapproval es el ACTUAL — un webhook de
    // cancelled de un preapproval viejo no debe cancelar la sub nueva.
    const currentSub = await subscriptionService.getCurrentSubscription(userId);
    if (currentSub && currentSub.mpSubscriptionId && currentSub.mpSubscriptionId !== preapprovalId) {
      log.info({ userId, preapprovalId, current: currentSub.mpSubscriptionId }, 'Ignorando webhook cancelled de preapproval reemplazado');
      return;
    }
    await subscriptionService.cancelSubscription(userId);
  } else if (info.status === 'past_due') {
    // C2: mismo guard — past_due de un preapproval viejo no afecta la sub actual.
    const currentSub = await subscriptionService.getCurrentSubscription(userId);
    if (currentSub && currentSub.mpSubscriptionId && currentSub.mpSubscriptionId !== preapprovalId) {
      log.info({ userId, preapprovalId, current: currentSub.mpSubscriptionId }, 'Ignorando webhook past_due de preapproval reemplazado');
      return;
    }
    await subscriptionService.updateSubscriptionStatus(userId, 'past_due');

    const [pastDueUser] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (pastDueUser?.email) {
      // Evitar emails duplicados — unique constraint on (userId, type)
      const [existing] = await db
        .select({ id: emailTracking.id })
        .from(emailTracking)
        .where(and(eq(emailTracking.userId, userId), eq(emailTracking.type, 'past_due')))
        .limit(1);
      if (existing) return;

      try {
        // D3: enviar PRIMERO y registrar el tracking SOLO si el send resolvió OK —
        // antes se marcaba como enviado aunque Resend fallara y el reintento
        // (webhook duplicado de MP) quedaba bloqueado por el check `existing`.
        await emailService.sendPastDueEmail(pastDueUser.email, pastDueUser.name, 7, `${config.FRONTEND_URL}/account`);
        await db.insert(emailTracking).values({ userId, type: 'past_due' }).onConflictDoNothing();
      } catch (err) {
        log.error({ err, userId }, 'Error enviando email de past_due:');
      }
    }
  }
}

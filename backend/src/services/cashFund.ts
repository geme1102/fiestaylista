import { eq, and, isNull, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, type PaginatedResult, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { cashFunds, cashContributions, events, users, platformFees } from '../db/schema.js';
import { config } from '../config.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import * as mercadopagoService from './mercadopago.js';
import { TIER_LIMITS, type Tier } from '../types/index.js';
import { randomUUID } from 'node:crypto';

const PLATFORM_FEE_CENTS = 30;

interface CashFundData {
  title?: string;
  description?: string;
  targetAmount?: number;
  bankPhone?: string;
  bankType?: string;
}

export async function createOrUpdateCashFund(eventId: string, _userId: string, data: CashFundData) {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: cashFunds.id })
      .from(cashFunds)
      .where(eq(cashFunds.eventId, eventId))
      .limit(1);

    if (existing.length > 0) {
      const [fund] = await tx
        .update(cashFunds)
        .set({
          title: data.title,
          description: data.description,
          targetAmount: data.targetAmount,
          bankPhone: data.bankPhone,
          bankType: data.bankType,
          updatedAt: new Date(),
        })
        .where(eq(cashFunds.id, existing[0].id))
        .returning();
      return fund;
    }

    const [fund] = await tx
      .insert(cashFunds)
      .values({
        eventId,
        title: data.title || 'Lluvia de sobres',
        description: data.description || null,
        targetAmount: data.targetAmount || null,
        bankPhone: data.bankPhone || null,
        bankType: data.bankType || null,
      })
      .onConflictDoNothing({ target: cashFunds.eventId })
      .returning();

    if (!fund) throw new ValidationError('El fondo monetario ya existe para este evento');
    return fund;
  });
}

export async function getCashFund(eventId: string) {
  const [fund] = await db
    .select()
    .from(cashFunds)
    .where(eq(cashFunds.eventId, eventId))
    .limit(1);

  return fund || null;
}

export async function getPromisedAmount(cashFundId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${cashContributions.amount}), 0)::int` })
    .from(cashContributions)
    .where(and(
      eq(cashContributions.cashFundId, cashFundId),
      eq(cashContributions.status, 'promised'),
    ));
  return row?.total ?? 0;
}

export async function createPromise(
  cashFundId: string,
  contributorName: string,
  amountInCents: number,
  message?: string,
): Promise<{ contribution: typeof cashContributions.$inferSelect; promisedTotal: number }> {
  const cleanedName = contributorName.replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  if (!cleanedName) {
    throw new ValidationError('El nombre es requerido');
  }

  if (amountInCents < 2000) {
    throw new ValidationError('El monto mínimo es $2,000 COP');
  }

  const contribution = await db.transaction(async (tx) => {
    const [fund] = await tx
      .select({ id: cashFunds.id, isActive: cashFunds.isActive, eventId: cashFunds.eventId })
      .from(cashFunds)
      .where(eq(cashFunds.id, cashFundId))
      .limit(1);

    if (!fund) throw new NotFoundError('Fondo no encontrado');
    if (!fund.isActive) throw new ValidationError('Este fondo ya no está activo');

    const [event] = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, fund.eventId), isNull(events.deletedAt), eq(events.isActive, true)))
      .limit(1);

    if (!event) throw new ValidationError('El evento ya no está disponible');

    // Idempotencia suave: una promesa pendiente del mismo nombre+monto se reutiliza
    const [existing] = await tx
      .select({ id: cashContributions.id })
      .from(cashContributions)
      .where(and(
        eq(cashContributions.cashFundId, cashFundId),
        eq(cashContributions.contributorName, cleanedName),
        eq(cashContributions.amount, amountInCents),
        eq(cashContributions.status, 'promised'),
      ))
      .limit(1);

    if (existing) {
      const [row] = await tx
        .update(cashContributions)
        .set({ message: message || null })
        .where(eq(cashContributions.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await tx
      .insert(cashContributions)
      .values({
        cashFundId,
        contributorName: cleanedName,
        amount: amountInCents,
        message: message || null,
        status: 'promised',
      })
      .returning();
    return row;
  });

  // Las promesas NO se suman a collectedAmount (dinero realmente cobrado).
  // El total prometido se calcula dinámicamente.
  const promisedTotal = await getPromisedAmount(cashFundId);

  return { contribution, promisedTotal };
}

export async function createContribution(
  cashFundId: string,
  contributorName: string,
  amountInCents: number,
  message?: string,
): Promise<{ redirectUrl: string; contributionId: string }> {
  const cleanedName = contributorName.replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  if (!cleanedName) {
    throw new ValidationError('El nombre es requerido');
  }

  if (amountInCents < 2000) {
    throw new ValidationError('El monto mínimo es $2,000 COP');
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${cashFundId} || ':' || ${cleanedName}))`);

    const [fund] = await tx
      .select()
      .from(cashFunds)
      .where(eq(cashFunds.id, cashFundId))
      .limit(1);

    if (!fund) throw new NotFoundError('Fondo no encontrado');
    if (!fund.isActive) throw new ValidationError('Este fondo ya no está activo');

    const [slugs] = await tx
      .select({ slug: events.slug })
      .from(events)
      .where(and(eq(events.id, fund.eventId), isNull(events.deletedAt)))
      .limit(1);

    const backUrl = `${config.FRONTEND_URL}/e/${slugs?.slug || fund.eventId}`;

    const [ownerInfo] = await tx
      .select({ tier: users.tier })
      .from(events)
      .innerJoin(users, eq(events.userId, users.id))
      .where(eq(events.id, fund.eventId))
      .limit(1);

    const ownerTier = (ownerInfo?.tier as Tier) || 'free';
    const commissionPercent = TIER_LIMITS[ownerTier]?.cashFundCommission ?? 5;
    const feeAmount = Math.round(amountInCents * (commissionPercent / 100)) + PLATFORM_FEE_CENTS;
    const netAmount = amountInCents - feeAmount;

    const [existingPending] = await tx
      .select({ id: cashContributions.id })
      .from(cashContributions)
      .where(and(
        eq(cashContributions.cashFundId, cashFundId),
        eq(cashContributions.contributorName, cleanedName),
        eq(cashContributions.amount, amountInCents),
        eq(cashContributions.status, 'pending'),
      ))
      .limit(1);

    if (existingPending) {
      throw new ValidationError('Ya tienes una contribución pendiente para este fondo');
    }

    const contributionId = randomUUID();
    const [contribution] = await tx
      .insert(cashContributions)
      .values({
        id: contributionId,
        cashFundId,
        contributorName: cleanedName,
        amount: amountInCents,
        feeAmount,
        netAmount,
        message: message || null,
        status: 'pending',
      })
      .returning();

    await tx.insert(platformFees).values({
      contributionId: contribution.id,
      amount: amountInCents,
      feeAmount,
      netAmount,
    });

    return { contribution, fund, backUrl };
  });

  let redirectUrl: string;
  try {
    const mpResult = await mercadopagoService.createContributionPreference(
      result.contribution.id,
      cleanedName,
      amountInCents,
      result.fund.title || 'Lluvia de Sobres',
      result.backUrl,
    );
    redirectUrl = mpResult.redirectUrl;
  } catch (err) {
    await db
      .update(cashContributions)
      .set({ status: 'failed' })
      .where(eq(cashContributions.id, result.contribution.id));
    throw err;
  }

  if (!redirectUrl) {
    await db
      .update(cashContributions)
      .set({ status: 'failed' })
      .where(eq(cashContributions.id, result.contribution.id));
    throw new ValidationError('No se pudo generar la URL de pago');
  }

  return { redirectUrl, contributionId: result.contribution.id };
}

export async function completeContribution(
  contributionId: string,
  mpPaymentId?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = { status: 'completed' };
    if (mpPaymentId) updateData.mpPaymentId = mpPaymentId;

    const [contribution] = await tx
      .update(cashContributions)
      .set(updateData)
      .where(and(
        eq(cashContributions.id, contributionId),
        eq(cashContributions.status, 'pending'),
      ))
      .returning();

    if (!contribution) return;

    // Atómico respecto al cambio de estado: si esto falla, el UPDATE anterior
    // se revierte y el fondo nunca se desfasa del dinero realmente cobrado.
    await tx
      .update(cashFunds)
      .set({
        collectedAmount: sql`${cashFunds.collectedAmount} + ${contribution.netAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(cashFunds.id, contribution.cashFundId));
  });
}

export async function revertContribution(contributionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [contribution] = await tx
      .update(cashContributions)
      .set({ status: 'refunded' })
      .where(and(
        eq(cashContributions.id, contributionId),
        eq(cashContributions.status, 'completed'),
      ))
      .returning();

    if (!contribution) return;

    await tx
      .update(cashFunds)
      .set({
        collectedAmount: sql`GREATEST(${cashFunds.collectedAmount} - ${contribution.netAmount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(cashFunds.id, contribution.cashFundId));
  });
}

export async function cleanupStaleContributions(): Promise<number> {
  const result = await db
    .update(cashContributions)
    .set({ status: 'expired' })
    .where(sql`${cashContributions.status} = 'pending' AND ${cashContributions.createdAt} < NOW() - (${config.CONTRIBUTION_EXPIRY_HOURS} * INTERVAL '1 hour')`)
    .returning({ id: cashContributions.id });

  return result.length;
}

export async function getContributions(
  cashFundId: string,
  params: PaginationParams = {},
): Promise<PaginatedResult<typeof cashContributions.$inferSelect>> {
  const { limit, cursorCondition } = buildPaginationConditions(
    cashContributions.createdAt as unknown as SQL,
    params,
    50,
  );

  const conditions = cursorCondition
    ? and(eq(cashContributions.cashFundId, cashFundId), cursorCondition)
    : eq(cashContributions.cashFundId, cashFundId);

  const rows = await db
    .select()
    .from(cashContributions)
    .where(conditions)
    .orderBy(desc(cashContributions.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].createdAt.toISOString() : null;

  return { data, nextCursor };
}

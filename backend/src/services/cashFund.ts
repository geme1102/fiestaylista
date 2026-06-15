import { eq, and, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, type PaginatedResult, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { cashFunds, cashContributions, events, users, platformFees } from '../db/schema.js';
import { config } from '../config.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import * as mercadopagoService from './mercadopago.js';
import { TIER_LIMITS, type Tier } from '../types/index.js';
import { randomUUID } from 'node:crypto';

const PLATFORM_FEE_CENTS = 30;

interface CashFundData {
  title?: string;
  description?: string;
  targetAmount?: number;
}

export async function createOrUpdateCashFund(eventId: string, userId: string, data: CashFundData) {
  return await db.transaction(async (tx) => {
    const [event] = await tx
      .select({ id: events.id, userId: events.userId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) throw new NotFoundError('Evento no encontrado');
    if (event.userId !== userId) throw new ForbiddenError('No tienes permiso para modificar este evento');

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
    const [fund] = await tx
      .select()
      .from(cashFunds)
      .where(eq(cashFunds.id, cashFundId))
      .for('update')
      .limit(1);

    if (!fund) throw new NotFoundError('Fondo no encontrado');
    if (!fund.isActive) throw new ValidationError('Este fondo ya no está activo');

    const [slugs] = await tx
      .select({ slug: events.slug })
      .from(events)
      .where(eq(events.id, fund.eventId))
      .limit(1);

    const backUrl = `${config.FRONTEND_URL}/e/${slugs?.slug || fund.eventId}`;

    const [ownerInfo] = await tx
      .select({ tier: users.tier })
      .from(events)
      .innerJoin(users, eq(events.userId, users.id))
      .where(eq(events.id, fund.eventId))
      .limit(1);

    const ownerTier = (ownerInfo?.tier as Tier) || 'free';
    const commissionPercent = TIER_LIMITS[ownerTier]?.cashFundCommission ?? 4;
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
    const [contribution] = await tx
      .select()
      .from(cashContributions)
      .where(eq(cashContributions.id, contributionId))
      .for('update')
      .limit(1);

    if (!contribution || contribution.status !== 'pending') return;

    const updateData: Record<string, unknown> = {
      status: 'completed',
    };
    if (mpPaymentId) {
      updateData.mpPaymentId = mpPaymentId;
    }

    await tx
      .update(cashContributions)
      .set(updateData)
      .where(eq(cashContributions.id, contribution.id));

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
      .select()
      .from(cashContributions)
      .where(eq(cashContributions.id, contributionId))
      .for('update')
      .limit(1);

    if (!contribution || contribution.status !== 'completed') return;

    await tx
      .update(cashContributions)
      .set({ status: 'refunded' })
      .where(eq(cashContributions.id, contribution.id));

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

import { eq, sql } from 'drizzle-orm';
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
  const [event] = await db
    .select({ id: events.id, userId: events.userId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new NotFoundError('Evento no encontrado');
  if (event.userId !== userId) throw new ForbiddenError('No tienes permiso para modificar este evento');

  const existing = await db
    .select({ id: cashFunds.id })
    .from(cashFunds)
    .where(eq(cashFunds.eventId, eventId))
    .limit(1);

  if (existing.length > 0) {
    const [fund] = await db
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

  const [fund] = await db
    .insert(cashFunds)
    .values({
      eventId,
      title: data.title || 'Lluvia de sobres',
      description: data.description || null,
      targetAmount: data.targetAmount || null,
    })
    .returning();

  return fund;
}

export async function getCashFund(eventId: string) {
  const [fund] = await db
    .select()
    .from(cashFunds)
    .where(eq(cashFunds.eventId, eventId))
    .limit(1);

  return fund || null;
}

async function getOwnerTier(eventId: string): Promise<Tier> {
  const [result] = await db
    .select({ tier: users.tier })
    .from(events)
    .innerJoin(users, eq(events.userId, users.id))
    .where(eq(events.id, eventId))
    .limit(1);

  return (result?.tier as Tier) || 'free';
}

export async function createContribution(
  cashFundId: string,
  contributorName: string,
  amountInCents: number,
  message?: string,
): Promise<{ redirectUrl: string; contributionId: string }> {
  const [fund] = await db
    .select()
    .from(cashFunds)
    .where(eq(cashFunds.id, cashFundId))
    .limit(1);

  if (!fund) throw new NotFoundError('Fondo no encontrado');
  if (!fund.isActive) throw new ValidationError('Este fondo ya no está activo');

  if (amountInCents < 2000) {
    throw new ValidationError('El monto mínimo es $2,000 COP');
  }

  const ownerTier = await getOwnerTier(fund.eventId);
  const commissionPercent = TIER_LIMITS[ownerTier]?.cashFundCommission ?? 4;
  const feeAmount = Math.round(amountInCents * (commissionPercent / 100)) + PLATFORM_FEE_CENTS;
  const netAmount = amountInCents - feeAmount;

  const tempContributionId = randomUUID();

  const [eventForSlug] = await db
    .select({ slug: events.slug })
    .from(events)
    .where(eq(events.id, fund.eventId))
    .limit(1);

  const backUrl = `${config.FRONTEND_URL}/e/${eventForSlug?.slug || fund.eventId}`;
  const { redirectUrl } = await mercadopagoService.createContributionPreference(
    tempContributionId,
    contributorName,
    amountInCents,
    fund.title || 'Lluvia de Sobres',
    backUrl,
  );

  if (!redirectUrl) {
    throw new ValidationError('No se pudo generar la URL de pago');
  }

  const result = await db.transaction(async (tx) => {
    const [contribution] = await tx
      .insert(cashContributions)
      .values({
        id: tempContributionId,
        cashFundId,
        contributorName,
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

    return contribution;
  });

  return { redirectUrl, contributionId: result.id };
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
    .where(sql`${cashContributions.status} = 'pending' AND ${cashContributions.createdAt} < NOW() - INTERVAL '24 hours'`)
    .returning({ id: cashContributions.id });

  return result.length;
}

export async function getContributions(cashFundId: string) {
  return db
    .select()
    .from(cashContributions)
    .where(eq(cashContributions.cashFundId, cashFundId))
    .orderBy(cashContributions.createdAt);
}

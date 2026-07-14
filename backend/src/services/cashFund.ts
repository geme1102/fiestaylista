import { eq, and, ne, isNull, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, type PaginatedResult, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { cashFunds, cashContributions, events } from '../db/schema.js';
import { sanitize, sanitizeAndStrip } from '../utils/sanitize.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { emitCashContribution } from './notifications.js';

interface CashFundData {
  title?: string;
  description?: string;
  targetAmount?: number;
  bankPhone?: string | null;
  bankType?: string | null;
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

    if (!fund) throw new ConflictError('El fondo monetario ya existe para este evento');
    return fund;
  });
}

export async function getCashFund(eventId: string) {
  const [fund] = await db
    .select({
      id: cashFunds.id,
      eventId: cashFunds.eventId,
      title: cashFunds.title,
      description: cashFunds.description,
      targetAmount: cashFunds.targetAmount,
      collectedAmount: cashFunds.collectedAmount,
      isActive: cashFunds.isActive,
      bankPhone: cashFunds.bankPhone,
      bankType: cashFunds.bankType,
      createdAt: cashFunds.createdAt,
      updatedAt: cashFunds.updatedAt,
    })
    .from(cashFunds)
    .where(eq(cashFunds.eventId, eventId))
    .limit(1);

  return fund || null;
}

export async function reconcileCashFunds(): Promise<{ fixed: number; checked: number }> {
  let fixed = 0;

  const totals = await db
    .select({
      cashFundId: cashContributions.cashFundId,
      total: sql<number>`COALESCE(SUM(${cashContributions.amount}), 0)::int`,
    })
    .from(cashContributions)
    .where(ne(cashContributions.status, 'cancelled'))
    .groupBy(cashContributions.cashFundId);

  const totalMap = new Map(totals.map(t => [t.cashFundId, t.total]));

  const funds: { id: string; collectedAmount: number }[] = [];
  const pageSize = 500;
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await db
      .select({
        id: cashFunds.id,
        collectedAmount: cashFunds.collectedAmount,
      })
      .from(cashFunds)
      .limit(pageSize)
      .offset(offset);
    if (page.length === 0) break;
    funds.push(...page);
    offset += pageSize;
  }

  for (const fund of funds) {
    const expected = totalMap.get(fund.id) ?? 0;
    if (fund.collectedAmount !== expected) {
      await db
        .update(cashFunds)
        .set({ collectedAmount: expected, updatedAt: new Date() })
        .where(eq(cashFunds.id, fund.id));
      fixed++;
    }
  }

  return { fixed, checked: funds.length };
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
): Promise<{ contribution: typeof cashContributions.$inferSelect; cashFund: typeof cashFunds.$inferSelect }> {
  const cleanedName = sanitize(contributorName);
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
      .for('update')
      .limit(1);

    if (!fund) throw new NotFoundError('Fondo no encontrado');
    if (!fund.isActive) throw new ValidationError('Este fondo ya no está activo');

    const [event] = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, fund.eventId), eq(events.status, 'active'), isNull(events.deletedAt), eq(events.isActive, true)))
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
        .set({ message: message ? sanitizeAndStrip(message) : null })
        .where(eq(cashContributions.id, existing.id))
        .returning();
      return { contribution: row, fund };
    }

    let [row] = await tx
      .insert(cashContributions)
      .values({
        cashFundId,
        contributorName: cleanedName,
        amount: amountInCents,
        message: message ? sanitizeAndStrip(message) : null,
        status: 'promised',
      })
      .returning();

    const [updatedFund] = await tx
      .update(cashFunds)
      .set({
        collectedAmount: sql`${cashFunds.collectedAmount} + ${amountInCents}`,
        updatedAt: new Date(),
      })
      .where(eq(cashFunds.id, cashFundId))
      .returning();

    return { contribution: row, fund: updatedFund };
  });

  emitCashContribution({
    eventId: result.fund.eventId,
    contributorName: result.contribution.contributorName,
    amount: result.contribution.amount,
    type: 'created',
    timestamp: new Date().toISOString(),
  });

  return { contribution: result.contribution, cashFund: result.fund };
}

export async function cancelContribution(
  contributionId: string,
  cashFundId: string,
): Promise<{ contribution: typeof cashContributions.$inferSelect; cashFund: typeof cashFunds.$inferSelect }> {
  const result = await db.transaction(async (tx) => {
    const [contribution] = await tx
      .select()
      .from(cashContributions)
      .where(and(
        eq(cashContributions.id, contributionId),
        eq(cashContributions.cashFundId, cashFundId),
        eq(cashContributions.status, 'promised'),
      ))
      .for('update')
      .limit(1);

    if (!contribution) throw new NotFoundError('Aporte no encontrado o ya cancelado');

    const [updatedContribution] = await tx
      .update(cashContributions)
      .set({ status: 'cancelled' })
      .where(eq(cashContributions.id, contributionId))
      .returning();

    const [updatedFund] = await tx
      .update(cashFunds)
      .set({
        collectedAmount: sql`GREATEST(${cashFunds.collectedAmount} - ${contribution.amount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(cashFunds.id, cashFundId))
      .returning();

    return { contribution: updatedContribution, fund: updatedFund };
  });

  emitCashContribution({
    eventId: result.fund.eventId,
    contributorName: result.contribution.contributorName,
    amount: result.contribution.amount,
    type: 'cancelled',
    timestamp: new Date().toISOString(),
  });

  return { contribution: result.contribution, cashFund: result.fund };
}

export interface SafeContribution {
  id: string;
  cashFundId: string;
  contributorName: string;
  message: string | null;
  amount: number;
  status: string;
  createdAt: Date;
}

export async function getContributions(
  cashFundId: string,
  params: PaginationParams = {},
): Promise<PaginatedResult<SafeContribution>> {
  const { limit, cursorCondition } = buildPaginationConditions(
    cashContributions.createdAt as unknown as SQL,
    params,
    50,
  );

  const conditions = cursorCondition
    ? and(eq(cashContributions.cashFundId, cashFundId), cursorCondition)
    : eq(cashContributions.cashFundId, cashFundId);

  const rows = await db
    .select({
      id: cashContributions.id,
      cashFundId: cashContributions.cashFundId,
      contributorName: cashContributions.contributorName,
      message: cashContributions.message,
      amount: cashContributions.amount,
      status: cashContributions.status,
      createdAt: cashContributions.createdAt,
    })
    .from(cashContributions)
    .where(conditions)
    .orderBy(desc(cashContributions.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].createdAt.toISOString() : null;

  return { data, nextCursor };
}

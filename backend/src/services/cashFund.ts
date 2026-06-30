import { eq, and, isNull, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, type PaginatedResult, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { cashFunds, cashContributions, events } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

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
): Promise<{ contribution: typeof cashContributions.$inferSelect; cashFund: typeof cashFunds.$inferSelect }> {
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
      .for('update')
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
      return { contribution: row, fund };
    }

    let [row] = await tx
      .insert(cashContributions)
      .values({
        cashFundId,
        contributorName: cleanedName,
        amount: amountInCents,
        message: message || null,
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

  return { contribution: result.contribution, cashFund: result.fund };
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

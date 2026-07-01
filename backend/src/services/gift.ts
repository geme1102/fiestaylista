import { eq, and, isNull, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { users, events, gifts as giftsTable, giftClaims } from '../db/schema.js';
import { sanitize } from '../utils/sanitize.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { TIER_LIMITS } from '../types/index.js';
import type { Tier } from '../types/index.js';

export async function addGift(eventId: string, name: string) {
  const cleaned = sanitize(name);
  if (!cleaned) {
    throw new ValidationError('El nombre del regalo es requerido');
  }

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId})::bigint)`);

    const [event] = await tx
      .select({ userId: events.userId, isActive: events.isActive })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundError('Evento no encontrado');
    if (!event.isActive) throw new ValidationError('Este evento no está activo');

    const [user] = await tx
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, event.userId))
      .limit(1);

    const tier = (user?.tier as Tier) || 'free';
    const limits = TIER_LIMITS[tier];
    if (limits) {
      const [countResult] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(giftsTable)
        .where(and(eq(giftsTable.eventId, eventId), isNull(giftsTable.deletedAt)));

      const giftCount = Number(countResult?.count ?? 0);
      if (giftCount >= limits.maxGiftsPerEvent) {
        throw new ValidationError(`Has alcanzado el límite de ${limits.maxGiftsPerEvent} regalos por evento en tu plan ${tier}`);
      }
    }

    try {
      const [gift] = await tx
        .insert(giftsTable)
        .values({ eventId, name: cleaned })
        .returning();
      return gift;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError('Ya existe un regalo con ese nombre');
      }
      throw err;
    }
  });
}

export async function updateGift(
  giftId: string,
  data: { isClaimed?: boolean; claimedBy?: string | null },
) {
  const updateData: Record<string, unknown> = {};

  if (data.isClaimed !== undefined) {
    updateData.isClaimed = data.isClaimed;
    if (data.isClaimed && !data.claimedBy) {
      throw new ValidationError('Debes especificar quién reserva el regalo');
    }
  }

  if (data.claimedBy !== undefined) {
    updateData.claimedBy = data.claimedBy ? sanitize(data.claimedBy) : null;
  }

  if (data.isClaimed === false) {
    updateData.claimedBy = null;
  }

  const whereConditions = [eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)];
  if (data.isClaimed === true) {
    whereConditions.push(eq(giftsTable.isClaimed, false));
  }

  const [gift] = await db
    .update(giftsTable)
    .set(updateData)
    .where(and(...whereConditions))
    .returning();

  if (!gift) {
    const [existing] = await db
      .select({ id: giftsTable.id, isClaimed: giftsTable.isClaimed })
      .from(giftsTable)
      .where(eq(giftsTable.id, giftId))
      .limit(1);
    if (!existing) {
      throw new NotFoundError('Regalo no encontrado');
    }
    if (data.isClaimed === true) {
      throw new ValidationError('Este regalo ya ha sido reservado por otra persona');
    }
    throw new NotFoundError('Regalo no encontrado');
  }

  return gift;
}

export async function claimGift(giftId: string, claimedBy: string) {
  const cleanedName = sanitize(claimedBy);
  if (!cleanedName) {
    throw new ValidationError('El nombre es requerido');
  }

  const [giftWithEvent] = await db
    .select({ eventId: giftsTable.eventId })
    .from(giftsTable)
    .where(eq(giftsTable.id, giftId))
    .limit(1);

  if (giftWithEvent) {
    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, giftWithEvent.eventId))
      .limit(1);

    if (event && event.status === 'completed') {
      throw new ValidationError('El evento ha finalizado y ya no acepta regalos');
    }
  }

  const [updated] = await db
    .update(giftsTable)
    .set({
      isClaimed: true,
      claimedBy: cleanedName,
    })
    .where(and(eq(giftsTable.id, giftId), eq(giftsTable.isClaimed, false), isNull(giftsTable.deletedAt)))
    .returning();

  if (!updated) {
    const [existing] = await db
      .select({ id: giftsTable.id })
      .from(giftsTable)
      .where(eq(giftsTable.id, giftId))
      .limit(1);
    if (!existing) {
      throw new NotFoundError('Regalo no encontrado');
    }
    throw new ValidationError('Este regalo ya ha sido reservado');
  }
  return updated;
}

export async function releaseGift(giftId: string) {
  const [gift] = await db
    .update(giftsTable)
    .set({ isClaimed: false, claimedBy: null })
    .where(and(eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)))
    .returning();

  if (!gift) {
    throw new NotFoundError('Regalo no encontrado');
  }

  return gift;
}

export async function deleteGift(giftId: string) {
  const [gift] = await db
    .update(giftsTable)
    .set({ deletedAt: new Date() })
    .where(eq(giftsTable.id, giftId))
    .returning();

  if (!gift) {
    throw new NotFoundError('Regalo no encontrado');
  }

  return { success: true };
}

export async function getEventGifts(eventId: string, params: PaginationParams = {}) {
  const { limit, cursorCondition } = buildPaginationConditions(
    giftsTable.createdAt as unknown as SQL,
    params,
    50,
  );
  const conditions = cursorCondition
    ? and(eq(giftsTable.eventId, eventId), isNull(giftsTable.deletedAt), cursorCondition)
    : and(eq(giftsTable.eventId, eventId), isNull(giftsTable.deletedAt));

  const eventGifts = await db
    .select()
    .from(giftsTable)
    .where(conditions)
    .orderBy(desc(giftsTable.createdAt))
    .limit(limit);

  return eventGifts;
}

export async function addGroupClaim(giftId: string, claimedBy: string, message?: string) {
  const cleanedName = sanitize(claimedBy);
  if (!cleanedName) throw new ValidationError('El nombre es requerido');

  const [giftWithEvent] = await db
    .select({ eventId: giftsTable.eventId })
    .from(giftsTable)
    .where(eq(giftsTable.id, giftId))
    .limit(1);

  if (giftWithEvent) {
    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, giftWithEvent.eventId))
      .limit(1);

    if (event && event.status === 'completed') {
      throw new ValidationError('El evento ha finalizado y ya no acepta regalos');
    }
  }

  return await db.transaction(async (tx) => {
    const [gift] = await tx
      .select({ isGroupGift: giftsTable.isGroupGift, isClaimed: giftsTable.isClaimed })
      .from(giftsTable)
      .where(eq(giftsTable.id, giftId))
      .for('update')
      .limit(1);

    if (!gift) throw new NotFoundError('Regalo no encontrado');
    if (!gift.isGroupGift) throw new ValidationError('Este regalo no es grupal');
    if (gift.isClaimed) throw new ValidationError('Este regalo ya ha sido reservado por un grupo completo');

    const [claim] = await tx
      .insert(giftClaims)
      .values({ giftId, claimedBy: cleanedName, message: message || null })
      .returning();

    return { claim };
  });
}

export async function getGiftClaims(giftId: string) {
  const claims = await db
    .select()
    .from(giftClaims)
    .where(eq(giftClaims.giftId, giftId))
    .orderBy(desc(giftClaims.createdAt));

  return claims;
}

export async function toggleGroupGift(giftId: string, isGroupGift: boolean) {
  const [gift] = await db
    .update(giftsTable)
    .set({ isGroupGift })
    .where(eq(giftsTable.id, giftId))
    .returning();

  if (!gift) throw new NotFoundError('Regalo no encontrado');
  return gift;
}

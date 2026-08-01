import { eq, and, isNull, sql, desc, type SQL } from 'drizzle-orm';
import { type PaginationParams, buildPaginationConditions } from '../utils/pagination.js';
import { db } from '../db/index.js';
import { users, events, gifts as giftsTable, giftClaims } from '../db/schema.js';
import { sanitize, sanitizeAndStrip } from '../utils/sanitize.js';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../utils/errors.js';
import { TIER_LIMITS } from '../types/index.js';
import type { Tier } from '../types/index.js';
import { ensureEventNotFrozen } from './event.js';

const MAX_GROUP_PARTICIPANTS = 50;

export async function addGift(eventId: string, name: string) {
  const cleaned = sanitize(name);
  if (!cleaned) {
    throw new ValidationError('El nombre del regalo es requerido');
  }

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId})::bigint)`);

    const [event] = await tx
      .select({ userId: events.userId, isActive: events.isActive, frozenAt: events.frozenAt })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundError('Evento no encontrado');
    if (event.frozenAt) throw new ValidationError('Este evento está congelado. Reactívalo desde la configuración.');
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
  return await db.transaction(async (tx) => {
    const [giftMeta] = await tx
      .select({ eventId: giftsTable.eventId, frozenAt: events.frozenAt })
      .from(giftsTable)
      .innerJoin(events, eq(giftsTable.eventId, events.id))
      .where(and(eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)))
      .for('update')
      .limit(1);

    if (!giftMeta) throw new NotFoundError('Regalo no encontrado');
    if (giftMeta.frozenAt) throw new ValidationError('Este evento está congelado. Reactívalo desde la configuración.');

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

    const [gift] = await tx
      .update(giftsTable)
      .set(updateData)
      .where(and(...whereConditions))
      .returning();

    if (!gift) {
      if (data.isClaimed === true) {
        throw new ValidationError('Este regalo ya ha sido reservado por otra persona');
      }
      throw new NotFoundError('Regalo no encontrado');
    }

    return gift;
  });
}

export async function claimGift(giftId: string, claimedBy: string, expectedEventId?: string) {
  const cleanedName = sanitize(claimedBy);
  if (!cleanedName) {
    throw new ValidationError('El nombre es requerido');
  }

  return await db.transaction(async (tx) => {
    const [giftWithEvent] = await tx
      .select({ eventId: giftsTable.eventId, isClaimed: giftsTable.isClaimed, isGroupGift: giftsTable.isGroupGift })
      .from(giftsTable)
      .where(and(eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)))
      .limit(1);

    if (!giftWithEvent) throw new NotFoundError('Regalo no encontrado');

    if (expectedEventId && giftWithEvent.eventId !== expectedEventId) {
      throw new NotFoundError('Regalo no encontrado');
    }

    if (giftWithEvent.isClaimed) {
      throw new ValidationError('Este regalo ya ha sido reservado');
    }

    if (giftWithEvent.isGroupGift) {
      throw new ValidationError('Este regalo es grupal — usa la opción de unirse al grupo');
    }

    const [event] = await tx
      .select({ status: events.status, isActive: events.isActive })
      .from(events)
      .where(and(eq(events.id, giftWithEvent.eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event || !event.isActive) {
      throw new ValidationError('El evento no está activo');
    }
    if (event.status === 'completed') {
      throw new ValidationError('El evento ha finalizado y ya no acepta regalos');
    }

    const [updated] = await tx
      .update(giftsTable)
      .set({
        isClaimed: true,
        claimedBy: cleanedName,
      })
      .where(and(eq(giftsTable.id, giftId), eq(giftsTable.isClaimed, false), isNull(giftsTable.deletedAt)))
      .returning();

    if (!updated) {
      throw new ValidationError('Este regalo ya ha sido reservado');
    }
    return updated;
  });
}

export async function releaseGift(giftId: string, userId: string) {
  const [giftMeta] = await db
    .select({ eventId: giftsTable.eventId, ownerId: events.userId })
    .from(giftsTable)
    .innerJoin(events, eq(giftsTable.eventId, events.id))
    .where(eq(giftsTable.id, giftId))
    .limit(1);
  if (!giftMeta) throw new NotFoundError('Regalo no encontrado');
  if (giftMeta.ownerId !== userId) throw new ForbiddenError('No tienes permiso para liberar este regalo');
  await ensureEventNotFrozen(giftMeta.eventId);

  return await db.transaction(async (tx) => {
    await tx.delete(giftClaims).where(eq(giftClaims.giftId, giftId));

    const [gift] = await tx
      .update(giftsTable)
      .set({ isClaimed: false, claimedBy: null })
      .where(and(eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)))
      .returning();

    if (!gift) {
      throw new NotFoundError('Regalo no encontrado');
    }

    return gift;
  });
}

export async function deleteGift(giftId: string) {
  const [giftMeta] = await db
    .select({ eventId: giftsTable.eventId })
    .from(giftsTable)
    .where(eq(giftsTable.id, giftId))
    .limit(1);
  if (giftMeta) await ensureEventNotFrozen(giftMeta.eventId);

  return await db.transaction(async (tx) => {
    await tx.delete(giftClaims).where(eq(giftClaims.giftId, giftId));

    const [gift] = await tx
      .update(giftsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)))
      .returning();

    if (!gift) {
      throw new NotFoundError('Regalo no encontrado');
    }

    return { success: true };
  });
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

export async function addGroupClaim(giftId: string, claimedBy: string, message?: string, expectedEventId?: string) {
  const cleanedName = sanitize(claimedBy);
  if (!cleanedName) throw new ValidationError('El nombre es requerido');

  return await db.transaction(async (tx) => {
    const [gift] = await tx
      .select({ isGroupGift: giftsTable.isGroupGift, isClaimed: giftsTable.isClaimed, eventId: giftsTable.eventId })
      .from(giftsTable)
      .where(and(eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)))
      .for('update')
      .limit(1);

    if (!gift) throw new NotFoundError('Regalo no encontrado');

    if (expectedEventId && gift.eventId !== expectedEventId) {
      throw new NotFoundError('Regalo no encontrado');
    }

    if (!gift.isGroupGift) throw new ValidationError('Este regalo no es grupal');
    if (gift.isClaimed) throw new ValidationError('Este regalo ya ha sido reservado por un grupo completo');

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(giftClaims)
      .where(eq(giftClaims.giftId, giftId));
    if (Number(countResult?.count ?? 0) >= MAX_GROUP_PARTICIPANTS) {
      throw new ValidationError(`Este regalo grupal ya tiene el máximo de ${MAX_GROUP_PARTICIPANTS} participantes`);
    }

    const [event] = await tx
      .select({ status: events.status, isActive: events.isActive })
      .from(events)
      .where(and(eq(events.id, gift.eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event || !event.isActive) {
      throw new ValidationError('El evento no está activo');
    }
    if (event.status === 'completed') {
      throw new ValidationError('El evento ha finalizado y ya no acepta regalos');
    }

    let claim;
    try {
      [claim] = await tx
        .insert(giftClaims)
        .values({ giftId, claimedBy: cleanedName, message: message ? sanitizeAndStrip(message) : null })
        .returning();
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ValidationError('Ya te has unido a este regalo grupal');
      }
      throw err;
    }

    return { claim };
  });
}

export async function getGiftClaims(giftId: string) {
  const claims = await db
    .select({
      id: giftClaims.id,
      giftId: giftClaims.giftId,
      claimedBy: giftClaims.claimedBy,
      message: giftClaims.message,
      createdAt: giftClaims.createdAt,
    })
    .from(giftClaims)
    .innerJoin(giftsTable, eq(giftClaims.giftId, giftsTable.id))
    .where(and(eq(giftClaims.giftId, giftId), isNull(giftsTable.deletedAt)))
    .orderBy(desc(giftClaims.createdAt))
    .limit(100);

  return claims;
}

export async function toggleGroupGift(giftId: string, isGroupGift: boolean) {
  const [giftMeta] = await db
    .select({ eventId: giftsTable.eventId })
    .from(giftsTable)
    .where(eq(giftsTable.id, giftId))
    .limit(1);
  if (giftMeta) await ensureEventNotFrozen(giftMeta.eventId);

  return await db.transaction(async (tx) => {
    const [gift] = await tx
      .select({ id: giftsTable.id, isClaimed: giftsTable.isClaimed, claimedBy: giftsTable.claimedBy, isGroupGift: giftsTable.isGroupGift, deletedAt: giftsTable.deletedAt })
      .from(giftsTable)
      .where(and(eq(giftsTable.id, giftId), isNull(giftsTable.deletedAt)))
      .for('update')
      .limit(1);

    if (!gift) throw new NotFoundError('Regalo no encontrado');

    if (isGroupGift) {
      if (gift.claimedBy) {
        await tx.insert(giftClaims).values({ giftId, claimedBy: gift.claimedBy }).onConflictDoNothing();
      }
      const [updated] = await tx
        .update(giftsTable)
        .set({ isGroupGift: true, claimedBy: null, isClaimed: false })
        .where(eq(giftsTable.id, giftId))
        .returning();
      return updated;
    }

    const existingClaims = await tx
      .select()
      .from(giftClaims)
      .where(eq(giftClaims.giftId, giftId))
      .limit(2);

    if (existingClaims.length > 1) {
      throw new ValidationError('No se puede cambiar a individual: el regalo tiene múltiples personas que ya se unieron');
    }

    const [updated] = await tx
      .update(giftsTable)
      .set({
        isGroupGift: false,
        claimedBy: existingClaims[0]?.claimedBy ?? null,
        isClaimed: existingClaims.length === 1,
      })
      .where(eq(giftsTable.id, giftId))
      .returning();

    if (existingClaims.length === 1) {
      await tx.delete(giftClaims).where(eq(giftClaims.giftId, giftId));
    }

    return updated;
  });
}

import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gifts as giftsTable } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

function sanitize(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}

export async function addGift(eventId: string, name: string) {
  const cleaned = sanitize(name);
  if (!cleaned) {
    throw new ValidationError('El nombre del regalo es requerido');
  }

  const [gift] = await db
    .insert(giftsTable)
    .values({ eventId, name: cleaned })
    .returning();

  return gift;
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

  const whereConditions = [eq(giftsTable.id, giftId)];
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

  const [updated] = await db
    .update(giftsTable)
    .set({
      isClaimed: true,
      claimedBy: cleanedName,
    })
    .where(and(eq(giftsTable.id, giftId), eq(giftsTable.isClaimed, false)))
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
    .where(eq(giftsTable.id, giftId))
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

export async function getEventGifts(eventId: string) {
  const eventGifts = await db
    .select()
    .from(giftsTable)
    .where(and(eq(giftsTable.eventId, eventId), isNull(giftsTable.deletedAt)))
    .orderBy(giftsTable.createdAt)
    .limit(101);

  return eventGifts;
}

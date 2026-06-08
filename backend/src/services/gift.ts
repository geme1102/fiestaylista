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
    .values({
      eventId,
      name: cleaned,
    })
    .returning();

  return gift;
}

export async function updateGift(
  giftId: string,
  data: { isClaimed?: boolean; claimedBy?: string | null },
) {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(giftsTable)
      .where(eq(giftsTable.id, giftId))
      .for('update')
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Regalo no encontrado');
    }

    if (data.isClaimed === true && existing.isClaimed && existing.claimedBy !== data.claimedBy) {
      throw new ValidationError('Este regalo ya ha sido reservado por otra persona');
    }

    if (data.isClaimed === true && !data.claimedBy) {
      throw new ValidationError('Debes especificar quién reserva el regalo');
    }

    const updateData: Record<string, unknown> = {};
    if (data.isClaimed !== undefined) updateData.isClaimed = data.isClaimed;
    if (data.claimedBy !== undefined) updateData.claimedBy = data.claimedBy || null;

    if (data.isClaimed === false) {
      updateData.claimedBy = null;
    }

    const [gift] = await tx
      .update(giftsTable)
      .set(updateData)
      .where(eq(giftsTable.id, giftId))
      .returning();

    return gift;
  });
}

export async function claimGift(giftId: string, claimedBy: string) {
  const cleanedName = sanitize(claimedBy);
  if (!cleanedName) {
    throw new ValidationError('El nombre es requerido');
  }

  return await db.transaction(async (tx) => {
    const [gift] = await tx
      .select()
      .from(giftsTable)
      .where(eq(giftsTable.id, giftId))
      .for('update')
      .limit(1);

    if (!gift) {
      throw new NotFoundError('Regalo no encontrado');
    }

    if (gift.isClaimed) {
      throw new ValidationError('Este regalo ya ha sido reservado');
    }

    const [updated] = await tx
      .update(giftsTable)
      .set({
        isClaimed: true,
        claimedBy: cleanedName,
      })
      .where(eq(giftsTable.id, giftId))
      .returning();

    return updated;
  });
}

export async function releaseGift(giftId: string) {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(giftsTable)
      .where(eq(giftsTable.id, giftId))
      .for('update')
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Regalo no encontrado');
    }

    const [gift] = await tx
      .update(giftsTable)
      .set({
        isClaimed: false,
        claimedBy: null,
      })
      .where(eq(giftsTable.id, giftId))
      .returning();

    return gift;
  });
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

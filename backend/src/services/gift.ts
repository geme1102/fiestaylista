import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gifts as giftsTable } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';

export async function addGift(eventId: string, name: string) {
  const [gift] = await db
    .insert(giftsTable)
    .values({
      eventId,
      name,
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
      throw new NotFoundError('Este regalo ya ha sido reservado por otra persona');
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
      throw new NotFoundError('Este regalo ya ha sido reservado');
    }

    const [updated] = await tx
      .update(giftsTable)
      .set({
        isClaimed: true,
        claimedBy,
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
    .delete(giftsTable)
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
    .where(eq(giftsTable.eventId, eventId))
    .orderBy(giftsTable.createdAt);

  return eventGifts;
}

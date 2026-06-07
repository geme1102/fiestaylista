import { eq, and, inArray } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../db/index.js';
import { users, events, gifts, photos, cashFunds, cashContributions, subscriptions, consentRecords, arcoRequests } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { cancelPreapproval } from './mercadopago.js';

export async function getUserData(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new NotFoundError('Usuario no encontrado');

  const userEvents = await db
    .select()
    .from(events)
    .where(eq(events.userId, userId));

  const eventIds = userEvents.map(e => e.id);

  const userGifts = eventIds.length > 0
    ? await db.select().from(gifts).where(inArray(gifts.eventId, eventIds))
    : [];

  const userPhotos = eventIds.length > 0
    ? await db.select().from(photos).where(inArray(photos.eventId, eventIds))
    : [];

  const userCashFunds = eventIds.length > 0
    ? await db.select().from(cashFunds).where(inArray(cashFunds.eventId, eventIds))
    : [];

  const cashFundIds = userCashFunds.map(cf => cf.id);
  const userContributions = cashFundIds.length > 0
    ? await db.select().from(cashContributions).where(inArray(cashContributions.cashFundId, cashFundIds))
    : [];

  const [userSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const userConsents = await db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId));

  const userArcoRequests = await db
    .select()
    .from(arcoRequests)
    .where(eq(arcoRequests.userId, userId));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
    events: userEvents,
    gifts: userGifts,
    photos: userPhotos,
    cashFunds: userCashFunds,
    contributions: userContributions,
    subscription: userSubscription ?? null,
    consentHistory: userConsents,
    arcoRequests: userArcoRequests,
  };
}

export async function deleteUserAccount(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new NotFoundError('Usuario no encontrado');

  const [activeSubscription] = await db
    .select({ id: subscriptions.id, mpSubscriptionId: subscriptions.mpSubscriptionId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .limit(1);

  if (activeSubscription?.mpSubscriptionId) {
    try {
      await cancelPreapproval(activeSubscription.mpSubscriptionId);
      console.log(`[ARCO] Subscripción MP cancelada: ${activeSubscription.mpSubscriptionId}`);
    } catch (err) {
      console.error('[ARCO] Error cancelando subscripción MP:', err);
    }
  }

  const userEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.userId, userId));

  const eventIds = userEvents.map(e => e.id);
  if (eventIds.length > 0) {
    const userPhotos = await db
      .select({ url: photos.url })
      .from(photos)
      .where(inArray(photos.eventId, eventIds));

    const cloudinaryDeletes = userPhotos
      .filter(p => p.url.includes('cloudinary.com'))
      .map(p => p.url.split('/').slice(-2).join('/').replace(/\.[^.]+$/, ''));

    const CONCURRENCY = 5;
    for (let i = 0; i < cloudinaryDeletes.length; i += CONCURRENCY) {
      const batch = cloudinaryDeletes.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(publicId =>
          Promise.race([
            cloudinary.uploader.destroy(publicId),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Cloudinary timeout')), 10000),
            ),
          ]),
        ),
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('[ARCO] Error deleting Cloudinary image:', result.reason);
        }
      }
    }
  }

  await db.delete(users).where(eq(users.id, userId));
}

export async function createArcoRequest(
  userId: string,
  requestType: 'access' | 'rectify' | 'cancel' | 'oppose',
  details?: string,
) {
  const [request] = await db
    .insert(arcoRequests)
    .values({
      userId,
      requestType,
      details,
      status: 'pending',
    })
    .returning();
  return request;
}

export async function getArcoRequests(userId: string) {
  return db
    .select()
    .from(arcoRequests)
    .where(eq(arcoRequests.userId, userId))
    .orderBy(arcoRequests.createdAt);
}

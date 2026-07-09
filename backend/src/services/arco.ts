import { eq, and, inArray } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../db/index.js';
import { users, events, gifts, photos, cashFunds, cashContributions, subscriptions, consentRecords, arcoRequests } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { getPublicIdFromUrl } from '../utils/cloudinary.js';
import { cancelPreapproval } from './mercadopago.js';
import { revokeAllUserTokens } from './auth-tokens.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('ARCO');

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

  const [userGifts, userPhotos, userCashFunds, userSubscription, userConsents, userArcoRequests] = await Promise.all([
    eventIds.length > 0
      ? db.select().from(gifts).where(inArray(gifts.eventId, eventIds))
      : Promise.resolve([]),
    eventIds.length > 0
      ? db.select().from(photos).where(inArray(photos.eventId, eventIds))
      : Promise.resolve([]),
    eventIds.length > 0
      ? db.select().from(cashFunds).where(inArray(cashFunds.eventId, eventIds))
      : Promise.resolve([]),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)
      .then(r => r[0] ?? null),
    db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.userId, userId)),
    db
      .select()
      .from(arcoRequests)
      .where(eq(arcoRequests.userId, userId)),
  ]);

  const cashFundIds = userCashFunds.map(cf => cf.id);
  const userContributions = cashFundIds.length > 0
    ? await db.select().from(cashContributions).where(inArray(cashContributions.cashFundId, cashFundIds))
    : [];

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
    subscription: userSubscription,
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
      log.info(`Subscripción MP cancelada: ${activeSubscription.mpSubscriptionId}`);
    } catch (err) {
      log.error({ err }, 'Error cancelando subscripción MP:');
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
      .map(p => getPublicIdFromUrl(p.url))
      .filter(Boolean) as string[];

    const CONCURRENCY = 5;
    for (let i = 0; i < cloudinaryDeletes.length; i += CONCURRENCY) {
      const batch = cloudinaryDeletes.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(publicId => {
          let timer: ReturnType<typeof setTimeout>;
          return Promise.race([
            cloudinary.uploader.destroy(publicId),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Cloudinary timeout')), 10000);
            }),
          ]).finally(() => clearTimeout(timer!));
        }),
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          log.error({ err: result.reason }, 'Error deleting Cloudinary image:');
        }
      }
    }
  }

  await revokeAllUserTokens(userId);
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

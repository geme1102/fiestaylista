import type { Response, NextFunction } from 'express';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, events, gifts } from '../db/schema.js';
import { ForbiddenError, ValidationError } from '../utils/errors.js';
import { TIER_LIMITS, TIER_ORDER } from '../types/index.js';
import type { AuthRequest, Tier } from '../types/index.js';

export function requireTier(minTier: Tier) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Acceso denegado');
      }

      const [user] = await db
        .select({ tier: users.tier })
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1);

      if (!user) {
        throw new ForbiddenError('Usuario no encontrado');
      }

      const userTier = user.tier as Tier;
      const userTierValue = TIER_ORDER[userTier] ?? 0;
      const minTierValue = TIER_ORDER[minTier] ?? 0;

      if (userTierValue < minTierValue) {
        throw new ForbiddenError(`Se requiere el plan ${minTier} para acceder a esta funcionalidad`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function checkEventLimit() {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Acceso denegado');
      }

      const [user] = await db
        .select({ tier: users.tier })
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1);

      if (!user) {
        throw new ForbiddenError('Usuario no encontrado');
      }

      const tier = user.tier as Tier;
      const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(eq(events.userId, req.user.userId));

      const eventCount = Number(countResult?.count ?? 0);

      if (eventCount >= limits.maxEvents) {
        throw new ValidationError(`Has alcanzado el límite de ${limits.maxEvents} eventos en tu plan ${tier}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function checkActiveEventLimit() {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Acceso denegado');
      }

      const body = req.body as { isActive?: boolean };
      if (body.isActive !== true) {
        next();
        return;
      }

      const [user] = await db
        .select({ tier: users.tier })
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1);

      if (!user) {
        throw new ForbiddenError('Usuario no encontrado');
      }

      const tier = user.tier as Tier;
      const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

      const eventId = req.params.id as string | undefined;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(and(
          eq(events.userId, req.user.userId),
          eq(events.isActive, true),
          eventId ? sql`${events.id} != ${eventId}` : undefined,
        ));

      const activeCount = Number(countResult?.count ?? 0);

      if (activeCount >= limits.maxEvents) {
        throw new ValidationError(`Has alcanzado el límite de ${limits.maxEvents} eventos activos en tu plan ${tier}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function checkGiftLimit(eventId: string) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Acceso denegado');
      }

      const [user] = await db
        .select({ tier: users.tier })
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1);

      if (!user) {
        throw new ForbiddenError('Usuario no encontrado');
      }

      const tier = user.tier as Tier;
      const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(gifts)
        .where(and(eq(gifts.eventId, eventId), isNull(gifts.deletedAt)));

      const giftCount = Number(countResult?.count ?? 0);

      if (giftCount >= limits.maxGiftsPerEvent) {
        throw new ValidationError(`Has alcanzado el límite de ${limits.maxGiftsPerEvent} regalos por evento en tu plan ${tier}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

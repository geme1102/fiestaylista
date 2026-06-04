import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { generateSlug, generateUniqueSlug } from '../utils/slug.js';
import { db } from '../db/index.js';
import { events, users } from '../db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { ValidationError } from '../utils/errors.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { randomUUID } from 'node:crypto';
import { guestLimiter } from '../middleware/rateLimit.js';

const router = Router();

const createGuestEventSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200, 'El título es demasiado largo'),
  eventType: z.enum(['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION', 'OTHER', 'HOUSE_WARMING'] as const, {
    errorMap: () => ({ message: 'Tipo de evento inválido' }),
  }),
  hostPhone: z.string().optional(),
  hostName: z.string().min(1, 'Tu nombre es requerido').max(100),
});

router.post('/events/guest', guestLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createGuestEventSchema.parse(req.body);
    const baseSlug = generateSlug(data.title);

    const existing = await db
      .select({ slug: events.slug })
      .from(events)
      .where(sql`${events.slug} LIKE ${`${baseSlug}%`}`)
      .limit(50);

    const existingSlugs = new Set(existing.map((e: { slug: string }) => e.slug));
    const slug = generateUniqueSlug(baseSlug, existingSlugs);

    const guestId = randomUUID();
    const guestEmail = `guest_${guestId}@guest.fiestaylista.com`;

    await db.insert(users).values({
      id: guestId,
      email: guestEmail,
      passwordHash: await bcrypt.hash(guestId, 12),
      name: data.hostName,
      tier: 'free',
      emailVerified: false,
    });

    const [event] = await db
      .insert(events)
      .values({
        userId: guestId,
        title: data.title,
        eventType: data.eventType,
        hostPhone: data.hostPhone || null,
        slug,
        isActive: true,
      })
      .returning();

    const accessToken = jwt.sign(
      { userId: guestId, email: guestEmail, isGuest: true },
      config.JWT_SECRET,
      { expiresIn: config.ACCESS_TOKEN_EXPIRY || '15m' } as any,
    );

    const refreshToken = jwt.sign(
      { userId: guestId, email: guestEmail, isGuest: true, type: 'refresh' },
      config.JWT_REFRESH_SECRET,
      { expiresIn: config.REFRESH_TOKEN_EXPIRY || '7d' } as any,
    );

    res.status(201).json({
      event,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map((e: any) => e.message).join(', ')));
      return;
    }
    next(error);
  }
});

router.put('/events/migrate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ValidationError('Token de acceso requerido');
    }

    const realToken = authHeader.split(' ')[1];
    const realDecoded = jwt.verify(realToken, config.JWT_SECRET) as any;

    if (realDecoded.isGuest) {
      throw new ValidationError('Se requiere un token de usuario registrado');
    }

    const { guestToken } = req.body as { guestToken: string };
    if (!guestToken) {
      throw new ValidationError('Token de invitado requerido');
    }

    const guestDecoded = jwt.verify(guestToken, config.JWT_GUEST_SECRET) as any;
    if (!guestDecoded.isGuest) {
      throw new ValidationError('Token de invitado inválido');
    }

    const targetUserId = realDecoded.userId;
    await db
      .update(events)
      .set({ userId: targetUserId })
      .where(eq(events.userId, guestDecoded.userId));

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError(error.errors.map((e: any) => e.message).join(', ')));
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ValidationError('Token inválido'));
      return;
    }
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { generateSlug, generateUniqueSlug } from '../utils/slug.js';
import { db } from '../db/index.js';
import { events, users } from '../db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { ValidationError } from '../utils/errors.js';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { randomUUID, randomBytes } from 'node:crypto';
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

function safeVerify(token: string, secret: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

router.post('/events/guest', guestLimiter, asyncHandlerWithValidation(async (req, res) => {
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
    passwordHash: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
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

  const opts: SignOptions = { expiresIn: config.ACCESS_TOKEN_EXPIRY || '15m' };
  const accessToken = jwt.sign(
    { userId: guestId, email: guestEmail, isGuest: true },
    config.JWT_GUEST_SECRET,
    opts,
  );

  const refreshOpts: SignOptions = { expiresIn: config.REFRESH_TOKEN_EXPIRY || '7d' };
  const refreshToken = jwt.sign(
    { userId: guestId, email: guestEmail, isGuest: true, type: 'refresh' },
    config.JWT_REFRESH_SECRET,
    refreshOpts,
  );

  res.status(201).json({
    event,
    accessToken,
    refreshToken,
  });
}));

router.put('/events/migrate', guestLimiter, asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ValidationError('Token de acceso requerido');
  }

  const realToken = authHeader.split(' ')[1];
  const realDecoded = safeVerify(realToken, config.JWT_SECRET);
  if (!realDecoded) {
    throw new ValidationError('Token inválido');
  }
  if ((realDecoded as any).isGuest) {
    throw new ValidationError('Se requiere un token de usuario registrado');
  }

  const { guestToken } = req.body as { guestToken: string };
  if (!guestToken) {
    throw new ValidationError('Token de invitado requerido');
  }

  const guestDecoded = safeVerify(guestToken, config.JWT_GUEST_SECRET);
  if (!guestDecoded || !(guestDecoded as any).isGuest) {
    throw new ValidationError('Token de invitado inválido');
  }

  const targetUserId = realDecoded.userId!;
  await db
    .update(events)
    .set({ userId: targetUserId })
    .where(eq(events.userId, guestDecoded.userId!));

  res.json({ success: true });
}));

export default router;

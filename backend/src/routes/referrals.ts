import { Router } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, referrals } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

router.get('/referrals/stats', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;

    const [user] = await db
      .select({ referralCode: users.referralCode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(eq(referrals.referrerId, userId))
      .then(r => r[0]?.count || 0);

    const pending = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.status, 'pending')))
      .then(r => r[0]?.count || 0);

    const completed = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(and(
        eq(referrals.referrerId, userId),
        eq(referrals.status, 'completed'),
        eq(referrals.bonusAwarded, true),
      ))
      .then(r => r[0]?.count || 0);

    const referralCode = user?.referralCode || userId.slice(0, 8);

    res.json({
      stats: { total, pending, completed, referralCode },
      shareUrl: `${req.protocol}://${req.get('host')}/register?ref=${referralCode}`,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/referrals/claim-bonus', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;

    const [referral] = await db
      .select()
      .from(referrals)
      .where(and(
        eq(referrals.referredEmail, req.user!.email),
        eq(referrals.status, 'completed'),
        eq(referrals.bonusAwarded, false),
      ))
      .limit(1);

    if (!referral) {
      res.json({ message: 'No hay bonos disponibles para reclamar' });
      return;
    }

    await db
      .update(referrals)
      .set({ bonusAwarded: true })
      .where(eq(referrals.id, referral.id));

    await db
      .update(users)
      .set({ tier: 'pro', updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.json({ message: '¡Bono reclamado! 1 mes Pro activado.' });
  } catch (error) {
    next(error);
  }
});

export async function trackReferral(referredEmail: string, referralCode: string): Promise<void> {
  if (!referralCode || referralCode.length < 4) return;

  const [referrer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);

  if (!referrer || referrer.id === referredEmail) return;

  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referrals)
    .where(and(
      eq(referrals.referrerId, referrer.id),
      eq(referrals.referredEmail, referredEmail),
    ))
    .then(r => r[0]?.count || 0);

  if (existing > 0) return;

  await db.insert(referrals).values({
    referrerId: referrer.id,
    referredEmail,
    status: 'pending',
  }).onConflictDoNothing();
}

export async function completeReferral(email: string): Promise<void> {
  const [referral] = await db
    .select()
    .from(referrals)
    .where(and(
      eq(referrals.referredEmail, email),
      eq(referrals.status, 'pending'),
    ))
    .limit(1);

  if (!referral) return;

  await db
    .update(referrals)
    .set({ status: 'completed' })
    .where(eq(referrals.id, referral.id));
}

export default router;

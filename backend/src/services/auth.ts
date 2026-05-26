import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, sql } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { config } from '../config.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.js';
import type { JwtPayload } from '../types/index.js';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  tier: string;
  emailVerified: boolean;
  createdAt: Date;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

async function persistRefreshToken(userId: string, token: string, client: DbClient = db): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await client.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  await client
    .delete(refreshTokens)
    .where(and(
      eq(refreshTokens.userId, userId),
      eq(refreshTokens.revoked, true),
    ));
}

async function consumeRefreshToken(token: string): Promise<JwtPayload> {
  const tokenHash = hashToken(token);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.revoked) {
    if (stored?.revoked) {
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.userId, stored.userId));
    }
    throw new UnauthorizedError('Token de refresco inválido o ya utilizado');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Token de refresco expirado');
  }

  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.id, stored.id));

  const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as JwtPayload;
  return decoded;
}

async function issueTokenPair(userId: string, email: string, client: DbClient = db): Promise<TokenPair> {
  const payload: JwtPayload = { userId, email };

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_EXPIRY as any,
  });

  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRY as any,
  });

  await persistRefreshToken(userId, refreshToken, client);

  return { accessToken, refreshToken };
}

function toUserResponse(user: typeof users.$inferSelect): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    emailVerified: user.emailVerified ?? false,
    createdAt: user.createdAt,
  };
}

function generateReferralCode(): string {
  return randomBytes(4).toString('hex');
}

export async function register(
  email: string,
  password: string,
  name: string,
  referralCode?: string,
): Promise<{ user: UserResponse; accessToken: string; refreshToken: string }> {
  const emailLower = email.toLowerCase();

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existing) {
      throw new ValidationError('El correo electrónico ya está registrado');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const userReferralCode = generateReferralCode();

    const [user] = await tx
      .insert(users)
      .values({
        email: emailLower,
        passwordHash,
        name,
        referralCode: userReferralCode,
        emailVerified: false,
        verificationToken,
        verificationTokenExpires,
      })
      .returning();

    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (err) {
      console.error('[Auth] Error al enviar email de verificación:', err);
    }

    if (referralCode) {
      const { trackReferral } = await import('../routes/referrals.js');
      await trackReferral(user.email, referralCode);
    }

    const tokens = await issueTokenPair(user.id, user.email, tx);

    return {
      user: toUserResponse(user),
      ...tokens,
    };
  });
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: UserResponse; accessToken: string; refreshToken: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const tokens = await issueTokenPair(user.id, user.email);

  return {
    user: toUserResponse(user),
    ...tokens,
  };
}

export async function refreshToken(
  token: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const decoded = await consumeRefreshToken(token);

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    return await issueTokenPair(user.id, user.email);
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;

    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token de refresco expirado');
    }

    throw new UnauthorizedError('Token de refresco inválido');
  }
}

export async function getUser(userId: string): Promise<UserResponse> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado');
  }

  return toUserResponse(user);
}

export async function verifyEmail(token: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.verificationToken, token))
    .limit(1);

  if (!user) {
    throw new ValidationError('Token de verificación inválido');
  }

  if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
    throw new ValidationError('Token de verificación expirado');
  }

  await db
    .update(users)
    .set({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ValidationError('Usuario no encontrado');
  }

  if (user.emailVerified) {
    throw new ValidationError('El correo ya está verificado');
  }

  const verificationToken = randomBytes(32).toString('hex');
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({ verificationToken, verificationTokenExpires, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await sendVerificationEmail(user.email, verificationToken);
}

export async function forgotPassword(email: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return;
  }

  const resetToken = randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

  await db
    .update(users)
    .set({ resetToken, resetTokenExpires, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await sendPasswordResetEmail(user.email, resetToken);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!user) {
    throw new ValidationError('Token de restablecimiento inválido');
  }

  if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
    throw new ValidationError('Token de restablecimiento expirado');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db
    .update(users)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

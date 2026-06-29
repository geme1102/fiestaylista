import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, or, sql } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { config } from '../config.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { sendVerificationEmail, sendPasswordResetEmail, isEmailConfigured } from './email.js';
import type { JwtPayload } from '../types/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Auth');

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

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type DbClient = typeof db;

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
      or(sql`${refreshTokens.revoked} = true`, sql`${refreshTokens.expiresAt} < NOW()`),
    ));
}

async function consumeRefreshToken(token: string): Promise<JwtPayload> {
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token de refresco expirado');
    }
    throw new UnauthorizedError('Token de refresco inválido');
  }

  const tokenHash = hashToken(token);

  const [revoked] = await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.revoked, false)))
    .returning({ id: refreshTokens.id, userId: refreshTokens.userId, expiresAt: refreshTokens.expiresAt });

  if (!revoked) {
    const [existing] = await db
      .select({ revoked: refreshTokens.revoked, userId: refreshTokens.userId, expiresAt: refreshTokens.expiresAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!existing) {
      throw new UnauthorizedError('Token de refresco inválido');
    }
    if (existing.revoked) {
      log.warn(`Intento de reuso de refresh token para usuario ${existing.userId}. Revocando todas las sesiones.`);
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.userId, existing.userId));
      throw new UnauthorizedError('Token de refresco inválido o ya utilizado');
    }
    throw new UnauthorizedError('Token de refresco expirado');
  }

  return decoded;
}

async function issueTokenPair(userId: string, email: string, client: DbClient = db): Promise<TokenPair> {
  const payload: JwtPayload = { userId, email, type: 'access' };

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
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

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<{ user: UserResponse; accessToken: string; refreshToken: string; emailSent: boolean }> {
  const emailLower = email.toLowerCase();
  const verificationToken = randomBytes(32).toString('hex');

  if (emailLower.endsWith('@guest.fiestaylista.com')) {
    throw new ValidationError('Este dominio de correo no está disponible para registro');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let user: typeof users.$inferSelect = null!;
  let tokens: TokenPair = null!;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existing) {
      throw new ValidationError('El correo electrónico ya está registrado');
    }

    const [newUser] = await tx
      .insert(users)
      .values({
        email: emailLower,
        passwordHash,
        name,
        tier: 'free',
        emailVerified: false,
        verificationToken,
        verificationTokenExpires,
      })
      .returning();

    user = newUser;
    tokens = await issueTokenPair(user.id, user.email, tx as unknown as typeof db);
  });

  let emailSent = false;
  try {
    if (isEmailConfigured()) {
      sendVerificationEmail(user.email, verificationToken)
        .then(() => { emailSent = true; })
        .catch((err) => log.error({ err }, 'Error enviando email de verificación:'));
      emailSent = true;
    } else {
      log.warn('Email service not configured — verification email not sent');
    }
  } catch (err) {
    log.error({ err }, 'Error al enviar email de verificación:');
  }

  return {
    user: toUserResponse(user),
    ...tokens,
    emailSent,
  };
}

const DUMMY_HASH = '$2a$12$OOQOQOQOQOQOQOQOQOQOQeQOQOQOQOQOQOQOQOQOQOQOQOQOQ';

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
    await bcrypt.compare(password, DUMMY_HASH);
    throw new UnauthorizedError('Credenciales inválidas');
  }

  if (user.email.endsWith('@guest.fiestaylista.com')) {
    await bcrypt.compare(password, DUMMY_HASH);
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
    return;
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

  if (!isEmailConfigured()) {
    throw new ValidationError('Email service not configured');
  }

  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (err) {
    log.error({ err }, 'Error al reenviar email de verificación:');
    throw new ValidationError('No se pudo enviar el correo de verificación. Intenta de nuevo más tarde.');
  }
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

  if (!isEmailConfigured()) {
    log.error('No se puede enviar email de restablecimiento: RESEND_API_KEY no configurada');
    throw new ValidationError('El servicio de correo no está configurado. Contacta al administrador.');
  }

  const resetToken = randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

  await db
    .update(users)
    .set({ resetToken, resetTokenExpires, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  try {
    await sendPasswordResetEmail(user.email, resetToken);
  } catch (err) {
    await db
      .update(users)
      .set({ resetToken: null, resetTokenExpires: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    log.error({ err }, 'Error al enviar email de restablecimiento:');
    throw new ValidationError('No se pudo enviar el correo de restablecimiento. Intenta de nuevo más tarde.');
  }
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

  await revokeAllUserTokens(user.id);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, userId));
}

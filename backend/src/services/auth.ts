import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { sendVerificationEmail, sendPasswordResetEmail, isEmailConfigured } from './email.js';
import { consumeRefreshToken, issueTokenPair, revokeAllUserTokens } from './auth-tokens.js';
export { hashToken, revokeAllUserTokens } from './auth-tokens.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Auth');

interface UserResponse {
  id: string;
  email: string;
  name: string;
  tier: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  welcomeTutorialCompleted: boolean;
  createdAt: Date;
}

const DUMMY_HASH = bcrypt.hashSync('dummy', 12);

function toUserResponse(user: typeof users.$inferSelect): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    emailVerified: user.emailVerified ?? false,
    onboardingCompleted: user.onboardingCompleted ?? false,
    welcomeTutorialCompleted: user.welcomeTutorialCompleted ?? false,
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
  let tokens: { accessToken: string; refreshToken: string } = null!;

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
    tokens = await issueTokenPair(user.id, user.email, tx);
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

export async function login(
  email: string,
  password: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: UserResponse; accessToken: string; refreshToken: string }> {
  try {
    const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    db.insert(auditLogs).values({
      action: 'auth.login.failed',
      resource: 'user',
      metadata: JSON.stringify({ email: email.toLowerCase(), reason: 'not_found' }),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log:'));
    throw new UnauthorizedError('Credenciales inválidas');
  }

  if (user.email.endsWith('@guest.fiestaylista.com')) {
    await bcrypt.compare(password, DUMMY_HASH);
    db.insert(auditLogs).values({
      userId: user.id,
      action: 'auth.login.failed',
      resource: 'user',
      resourceId: user.id,
      metadata: JSON.stringify({ email: email.toLowerCase(), reason: 'guest_login_attempt' }),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log:'));
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    db.insert(auditLogs).values({
      userId: user.id,
      action: 'auth.login.failed',
      resource: 'user',
      resourceId: user.id,
      metadata: JSON.stringify({ email: email.toLowerCase(), reason: 'wrong_password' }),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log:'));
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const tokens = await issueTokenPair(user.id, user.email);

  return {
    user: toUserResponse(user),
    ...tokens,
  };
} catch (error) {
  log.error({ err: error, email }, 'Error inesperado en login:');
  throw error;
}
}

export async function refreshToken(
  token: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const decoded = await consumeRefreshToken(token, meta);

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

export async function markOnboardingCompleted(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingCompleted: true })
    .where(eq(users.id, userId));
}

export async function markWelcomeCompleted(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ welcomeTutorialCompleted: true })
    .where(eq(users.id, userId));
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

  if (isEmailConfigured()) {
    sendVerificationEmail(user.email, verificationToken).catch((err: unknown) =>
      log.error({ err }, 'Error al reenviar email de verificación:'));
  } else {
    log.warn('Email service not configured — verification email not resent');
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

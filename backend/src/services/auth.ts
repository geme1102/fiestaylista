import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db, sql } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../utils/errors.js';
import { sendVerificationEmail, sendPasswordResetEmail, isEmailConfigured } from './email.js';
import { rotateRefreshToken, issueTokenPair, revokeAllUserTokens, hashToken } from './auth-tokens.js';
export { revokeAllUserTokens } from './auth-tokens.js';
import { createModuleLogger } from '../utils/logger.js';
import { isLocked, recordFailedAttempt, resetLockout, isIpThrottled, recordEmailFailedAttempt, isEmailLocked, resetEmailLockout } from '../middleware/lockout.js';
import { config } from '../config.js';

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
): Promise<{ user: UserResponse; accessToken: string; refreshToken: string }> {
  const emailLower = email.toLowerCase();
  const verificationToken = randomBytes(32).toString('hex');

  if (emailLower.endsWith('@guest.fiestaylista.com')) {
    throw new ValidationError('Este dominio de correo no está disponible para registro');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let user: typeof users.$inferSelect = null!;
  let tokens: { accessToken: string; refreshToken: string } = null!;

  try {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existing) {
      throw new ConflictError('El correo electrónico ya está registrado');
    }

    const [newUser] = await tx
      .insert(users)
      .values({
        email: emailLower,
        passwordHash,
        name,
        tier: 'free',
        emailVerified: false,
        verificationToken: hashToken(verificationToken),
        verificationTokenExpires,
      })
      .returning();

    user = newUser;
    tokens = await issueTokenPair(user.id, user.email, 0);
  });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw new ConflictError('El correo electrónico ya está registrado');
    }
    if (err instanceof ConflictError) throw err;
    log.error({ err }, 'Error en transacción de registro');
    throw err;
  }

  try {
    if (isEmailConfigured()) {
      sendVerificationEmail(user.email, verificationToken)
        .catch((err) => log.error({ err }, 'Error enviando email de verificación:'));
    } else {
      log.warn('Email service not configured — verification email not sent');
    }
  } catch (err) {
    log.error({ err }, 'Error al enviar email de verificación:');
  }

  return {
    user: toUserResponse(user),
    ...tokens,
  };
}

export async function login(
  email: string,
  password: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: UserResponse; accessToken: string; refreshToken: string }> {
  try {
    const emailLower = email.toLowerCase();
    const ip = meta?.ipAddress;
    if (ip && await isIpThrottled(ip)) {
      throw new UnauthorizedError('Demasiados intentos desde esta dirección. Intenta de nuevo más tarde.');
    }

    let rows: any[];
    try {
      rows = await sql`
        SELECT id, email, password_hash, name, tier, email_verified, created_at,
               onboarding_completed, welcome_tutorial_completed
        FROM users WHERE email = ${emailLower} LIMIT 1
      `;
    } catch (err) {
      log.warn({ err }, 'Query con columnas opcionales falló — usando fallback');
      rows = await sql`
        SELECT id, email, password_hash, name, tier, email_verified, created_at
        FROM users WHERE email = ${emailLower} LIMIT 1
      `;
    }
    const user = rows[0] as
      | {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          tier: string;
          email_verified: boolean;
          created_at: Date;
          onboarding_completed?: boolean;
          welcome_tutorial_completed?: boolean;
        }
      | undefined;

    // Check email-based lockout BEFORE user lookup — catches non-existent emails too
    if (await isEmailLocked(emailLower)) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedError('Demasiados intentos fallidos. Intenta de nuevo más tarde.');
    }

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    if (meta?.ipAddress) {
      await recordEmailFailedAttempt(emailLower, meta.ipAddress);
    }
    db.insert(auditLogs).values({
      action: 'auth.login.failed',
      resource: 'user',
      metadata: JSON.stringify({ emailHash: hashToken(emailLower), reason: 'not_found' }),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log:'));
    throw new UnauthorizedError('Credenciales inválidas');
  }

  if (await isLocked(user.id)) {
    // Run real bcrypt to equalize timing with the non-locked path
    await bcrypt.compare(password, user.password_hash);
    throw new UnauthorizedError('Demasiados intentos fallidos. Intenta de nuevo más tarde.');
  }

  if (user.email.endsWith('@guest.fiestaylista.com')) {
    await bcrypt.compare(password, DUMMY_HASH);
    recordFailedAttempt(user.id);
    await recordEmailFailedAttempt(emailLower, meta?.ipAddress ?? '');
    db.insert(auditLogs).values({
      userId: user.id,
      action: 'auth.login.failed',
      resource: 'user',
      resourceId: user.id,
      metadata: JSON.stringify({ emailHash: hashToken(emailLower), reason: 'guest_login_attempt' }),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log:'));
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    recordFailedAttempt(user.id);
    await recordEmailFailedAttempt(emailLower, meta?.ipAddress ?? '');
    db.insert(auditLogs).values({
      userId: user.id,
      action: 'auth.login.failed',
      resource: 'user',
      resourceId: user.id,
      metadata: JSON.stringify({ emailHash: hashToken(emailLower), reason: 'wrong_password' }),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log:'));
    throw new UnauthorizedError('Credenciales inválidas');
  }

  resetLockout(user.id);
  // Reset email lockout on successful login
  await resetEmailLockout(emailLower);
  // Get current tokenVersion before issuing new tokens
  const [currentUser] = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const tokens = await issueTokenPair(user.id, user.email, currentUser?.tokenVersion ?? 0);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      emailVerified: user.email_verified,
      onboardingCompleted: user.onboarding_completed ?? false,
      welcomeTutorialCompleted: user.welcome_tutorial_completed ?? false,
      createdAt: user.created_at,
    },
    ...tokens,
  };
} catch (error) {
    log.error({ err: error, email }, 'Error inesperado en login:');
    throw error;
}
}

export async function refreshToken(
  token: string
): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const tokens = await rotateRefreshToken(token);

    const [user] = await db
      .select({ id: users.id, email: users.email, tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, tokens.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'access', tokenVersion: user.tokenVersion },
      config.JWT_SECRET,
      { expiresIn: config.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'] }
    );

    return { accessToken, refreshToken: tokens.refreshToken };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;

    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token de refresco expirado');
    }

    throw new UnauthorizedError('Token de refresco inválido');
  }
}

export async function getUser(userId: string): Promise<UserResponse> {
  let rows: any[];
  try {
    rows = await sql`
      SELECT id, email, name, tier, email_verified, created_at,
             onboarding_completed, welcome_tutorial_completed
      FROM users WHERE id = ${userId} LIMIT 1
    `;
  } catch (err) {
    log.warn({ err, userId }, 'Query con columnas opcionales falló — usando fallback');
    rows = await sql`
      SELECT id, email, name, tier, email_verified, created_at
      FROM users WHERE id = ${userId} LIMIT 1
    `;
  }
  const user = rows[0] as
    | {
        id: string;
        email: string;
        name: string;
        tier: string;
        email_verified: boolean;
        created_at: Date;
        onboarding_completed?: boolean;
        welcome_tutorial_completed?: boolean;
      }
    | undefined;

  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    emailVerified: user.email_verified,
    onboardingCompleted: user.onboarding_completed ?? false,
    welcomeTutorialCompleted: user.welcome_tutorial_completed ?? false,
    createdAt: user.created_at,
  };
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
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      verificationToken: users.verificationToken,
      verificationTokenExpires: users.verificationTokenExpires,
    })
    .from(users)
    .where(eq(users.verificationToken, hashToken(token)))
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
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    })
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
    .set({ verificationToken: hashToken(verificationToken), verificationTokenExpires, updatedAt: new Date() })
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
    .select({
      id: users.id,
      email: users.email,
    })
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
    .set({ resetToken: hashToken(resetToken), resetTokenExpires, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  sendPasswordResetEmail(user.email, resetToken).catch((err: unknown) =>
    log.error({ err }, 'Error al enviar email de restablecimiento:'),
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const [user] = await db
    .select({
      id: users.id,
      resetTokenExpires: users.resetTokenExpires,
    })
    .from(users)
    .where(eq(users.resetToken, hashToken(token)))
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

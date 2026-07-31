import jwt from 'jsonwebtoken';
import { eq, and, or, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { refreshTokens, users, auditLogs } from '../db/schema.js';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('AuthTokens');

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

import type { PgTransaction } from 'drizzle-orm/pg-core';
type DbClient = typeof db | PgTransaction<any, any, any>;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function persistRefreshToken(
  userId: string,
  token: string,
  familyId: string,
  rotatedFrom: string | null = null,
  client: DbClient = db
): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await client.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    familyId,
    rotatedFrom,
  });

  await client
    .delete(refreshTokens)
    .where(and(
      eq(refreshTokens.userId, userId),
      or(
        sql`${refreshTokens.revoked} = true AND ${refreshTokens.expiresAt} < NOW() - INTERVAL '30 days'`,
        sql`${refreshTokens.revoked} = false AND ${refreshTokens.expiresAt} < NOW()`,
      ),
    ));
}

/**
 * Atomically consume a refresh token and issue a new token pair.
 * Uses atomic UPDATE...WHERE revoked=false RETURNING to serialize concurrent
 * rotations — only one request can claim the token, eliminating the race window.
 * Implements proper Refresh Token Rotation with family tracking.
 */
export async function rotateRefreshToken(
  token: string
): Promise<TokenPair> {
  const tokenHash = hashToken(token);

  // Transacción 1: claim atómico. Solo el camino de éxito escribe aquí.
  // El reuso se DETECTA sin escribir (ROLLBACK borraría las escrituras de
  // seguridad si se lanzara el error dentro de la transacción).
  const rotation = await db.transaction(async (tx) => {
    // Atomic claim: UPDATE...RETURNING serializes concurrent requests.
    // Only ONE request gets the row back; others get nothing.
    const [claimed] = await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.revoked, false)))
      .returning({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        expiresAt: refreshTokens.expiresAt,
        familyId: refreshTokens.familyId,
      });

    if (claimed) {
      // Success path — token was valid and not yet consumed
      if (claimed.expiresAt < new Date()) {
        throw new UnauthorizedError('Token de refresco expirado');
      }

      // Create new token in the SAME family
      const newFamilyId = claimed.familyId ?? randomBytes(16).toString('hex');
      const newToken = generateOpaqueToken();
      const newTokenHash = hashToken(newToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await tx.insert(refreshTokens).values({
        userId: claimed.userId,
        tokenHash: newTokenHash,
        expiresAt,
        familyId: newFamilyId,
        rotatedFrom: claimed.id,
      });

      // Cleanup old tokens
      await tx
        .delete(refreshTokens)
        .where(and(
          eq(refreshTokens.userId, claimed.userId),
          or(
            sql`${refreshTokens.revoked} = true AND ${refreshTokens.expiresAt} < NOW() - INTERVAL '30 days'`,
            sql`${refreshTokens.revoked} = false AND ${refreshTokens.expiresAt} < NOW()`,
          ),
        ));

      return {
        ok: true as const,
        tokenPair: { accessToken: '', refreshToken: newToken, userId: claimed.userId },
      };
    }

    // Token was NOT claimed — either doesn't exist or already revoked.
    // Fallback SELECT to determine which.
    const [existing] = await tx
      .select({ userId: refreshTokens.userId, familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!existing) {
      throw new UnauthorizedError('Token de refresco inválido');
    }

    // Token exists but was already revoked → REUSE DETECTED
    return { ok: false as const, userId: existing.userId, familyId: existing.familyId };
  });

  if (rotation.ok) {
    return rotation.tokenPair;
  }

  // Transacción 2 (separada): las escrituras de seguridad se COMMITEAN antes
  // de lanzar el error — sobreviven al throw.
  const { userId, familyId } = rotation;
  log.warn({ userId, familyId }, 'Intento de reuso de refresh token detectado. Revocando toda la familia.');

  await db.transaction(async (tx) => {
    if (familyId) {
      await tx
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.familyId, familyId));
    } else {
      // Legacy token without family — revoke all user's tokens
      await tx
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.userId, userId));
    }

    // Invalidate current access tokens on reuse detection
    await tx
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  });

  // Audit best-effort: nunca debe bloquear la revocación de seguridad
  db.insert(auditLogs).values({
    userId,
    action: 'TOKEN_REUSE',
    resource: 'auth',
    resourceId: userId,
    metadata: JSON.stringify({ detail: 'Refresh token reuse detected — entire family revoked', familyId: familyId ?? 'legacy' }),
  }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log de reuso de token:'));

  throw new UnauthorizedError('Token de refresco inválido o ya utilizado');
}

export async function issueTokenPair(userId: string, email: string, currentTokenVersion: number, client: DbClient = db): Promise<TokenPair> {
  const accessToken = jwt.sign(
    { userId, email, type: 'access', tokenVersion: currentTokenVersion },
    config.JWT_SECRET,
    { expiresIn: config.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'] }
  );

  const refreshToken = generateOpaqueToken();
  const familyId = randomBytes(16).toString('hex');

  await persistRefreshToken(userId, refreshToken, familyId, null, client);

  return { accessToken, refreshToken, userId };
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, userId));
  await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, userId));
}

export async function revokeTokenFamily(familyId: string, userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(and(eq(refreshTokens.familyId, familyId), eq(refreshTokens.userId, userId)));
}
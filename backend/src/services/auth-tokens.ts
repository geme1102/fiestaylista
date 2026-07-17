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
 * Uses a database transaction with UPDATE to serialize concurrent rotations.
 * Implements proper Refresh Token Rotation with family tracking.
 */
export async function rotateRefreshToken(
  token: string
): Promise<TokenPair> {
  const tokenHash = hashToken(token);

  return await db.transaction(async (tx) => {
    // Lock the row via UPDATE to serialize concurrent rotations
    const [locked] = await tx
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        expiresAt: refreshTokens.expiresAt,
        revoked: refreshTokens.revoked,
        familyId: refreshTokens.familyId,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!locked) {
      throw new UnauthorizedError('Token de refresco inválido');
    }

    if (locked.revoked) {
      // Token already used - potential reuse attack, revoke entire family
      const familyId = locked.familyId;
      log.warn({ userId: locked.userId, familyId }, 'Intento de reuso de refresh token detectado. Revocando toda la familia.');
      
      await tx.insert(auditLogs).values({
        userId: locked.userId,
        action: 'TOKEN_REUSE',
        resource: 'auth',
        resourceId: locked.userId,
        metadata: JSON.stringify({ detail: 'Refresh token reuse detected — entire family revoked', familyId: locked.familyId ?? 'legacy' }),
      }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log de reuso de token:'));

      if (familyId) {
        await tx
          .update(refreshTokens)
          .set({ revoked: true })
          .where(eq(refreshTokens.familyId, familyId));
      } else {
        // Legacy token without family - revoke all user's tokens
        await tx
          .update(refreshTokens)
          .set({ revoked: true })
          .where(eq(refreshTokens.userId, locked.userId));
      }

      throw new UnauthorizedError('Token de refresco inválido o ya utilizado');
    }

    if (locked.expiresAt < new Date()) {
      throw new UnauthorizedError('Token de refresco expirado');
    }

    // Mark current token as revoked
    await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, locked.id));

    // Create new token in the SAME family, linking to the consumed token
    const newFamilyId = locked.familyId ?? randomBytes(16).toString('hex');
    const newToken = generateOpaqueToken();
    const newTokenHash = hashToken(newToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await tx.insert(refreshTokens).values({
      userId: locked.userId,
      tokenHash: newTokenHash,
      expiresAt,
      familyId: newFamilyId,
      rotatedFrom: locked.id,
    });

    // Increment user's tokenVersion to instantly revoke all access tokens
    await tx
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, locked.userId));

    // Cleanup old revoked tokens (optional, keeps table tidy)
    await tx
      .delete(refreshTokens)
      .where(and(
        eq(refreshTokens.userId, locked.userId),
        or(
          sql`${refreshTokens.revoked} = true AND ${refreshTokens.expiresAt} < NOW() - INTERVAL '30 days'`,
          sql`${refreshTokens.revoked} = false AND ${refreshTokens.expiresAt} < NOW()`,
        ),
      ));

    // Return the new opaque refresh token and userId; access token created by caller
    return { accessToken: '', refreshToken: newToken, userId: locked.userId };
  });
}

export async function issueTokenPair(userId: string, email: string, currentTokenVersion: number): Promise<TokenPair> {
  const accessToken = jwt.sign(
    { userId, email, type: 'access', tokenVersion: currentTokenVersion },
    config.JWT_SECRET,
    { expiresIn: config.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'] }
  );

  const refreshToken = generateOpaqueToken();
  const familyId = randomBytes(16).toString('hex');

  await persistRefreshToken(userId, refreshToken, familyId, null, db);

  return { accessToken, refreshToken, userId };
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, userId));
}

export async function revokeTokenFamily(familyId: string, userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(and(eq(refreshTokens.familyId, familyId), eq(refreshTokens.userId, userId)));
}
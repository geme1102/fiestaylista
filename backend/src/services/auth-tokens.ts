import jwt from 'jsonwebtoken';
import { eq, and, or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { refreshTokens, auditLogs } from '../db/schema.js';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { JwtPayload } from '../types/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('AuthTokens');

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type DbClient = typeof db;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function persistRefreshToken(userId: string, token: string, client: DbClient = db): Promise<void> {
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

export async function consumeRefreshToken(token: string): Promise<JwtPayload> {
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
      const [activeToken] = await db
        .select({ id: refreshTokens.id })
        .from(refreshTokens)
        .where(and(
          eq(refreshTokens.userId, existing.userId),
          eq(refreshTokens.revoked, false),
          sql`${refreshTokens.expiresAt} > NOW()`,
        ))
        .limit(1);
      if (activeToken) {
        log.warn(`Reuso de refresh token para usuario ${existing.userId} — posible concurrencia entre pestañas`);
        return decoded;
      }
      log.warn(`Intento de reuso de refresh token para usuario ${existing.userId}. Revocando todas las sesiones.`);
      await db.insert(auditLogs).values({
        userId: existing.userId,
        action: 'TOKEN_REUSE',
        resource: 'auth',
        resourceId: existing.userId,
        metadata: JSON.stringify({ detail: 'Refresh token reuse detected — all sessions revoked' }),
      }).catch((err: unknown) => log.error({ err }, 'Error al registrar audit log de reuso de token:'));
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

export async function issueTokenPair(userId: string, email: string, client: DbClient = db): Promise<TokenPair> {
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

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, userId));
}

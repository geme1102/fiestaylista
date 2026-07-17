import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthRequest, JwtPayload } from '../types/index.js';

// Tokens SSE (EventSource) se firman con JWT_SECRET pero deben servir ÚNICAMENTE
// para el endpoint /subscribe. Si se presentan como access token en cualquier
// otro endpoint, deben rechazarse para evitar escalamiento de privilegios.
function isSseToken(decoded: unknown): boolean {
  return (
    typeof decoded === 'object' &&
    decoded !== null &&
    'scope' in decoded &&
    (decoded as { scope?: unknown }).scope === 'sse'
  );
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;

    if (isSseToken(decoded)) {
      throw new UnauthorizedError('Token inválido');
    }

    // Verify tokenVersion matches current user tokenVersion (instant revocation)
    const [user] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    if ((decoded.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedError('Token revocado. Por favor, inicia sesión de nuevo.');
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expirado'));
      return;
    }
    if (error instanceof jwt.NotBeforeError || error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token inválido'));
      return;
    }
    next(error);
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;

    if (isSseToken(decoded)) {
      next();
      return;
    }

    const [user] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (user && (decoded.tokenVersion ?? 0) === user.tokenVersion) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
    }

    next();
  } catch {
    next();
  }
}

export async function requireEmailVerified(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const [user] = await db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user?.emailVerified) {
      throw new ValidationError('Debes verificar tu correo electrónico antes de continuar. Revisa tu bandeja de entrada.');
    }

    next();
  } catch (error) {
    next(error);
  }
}

export { requireAuth as requireAnyAuth };

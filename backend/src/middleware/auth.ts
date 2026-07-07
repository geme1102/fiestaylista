import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthRequest, JwtPayload, GuestJwtPayload } from '../types/index.js';

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

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    let decoded: JwtPayload | GuestJwtPayload;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    } catch {
      try {
        decoded = jwt.verify(token, config.JWT_GUEST_SECRET, { algorithms: ['HS256'] }) as GuestJwtPayload;
      } catch {
        throw new UnauthorizedError('Token inválido');
      }
    }

    if (isSseToken(decoded)) {
      throw new UnauthorizedError('Token inválido');
    }

    if ('isGuest' in decoded && (decoded as GuestJwtPayload).isGuest) {
      throw new UnauthorizedError('Los tokens de invitado no tienen acceso a esta funcionalidad');
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
    next(error);
  }
}

export function requireAnyAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    let decoded: JwtPayload | GuestJwtPayload;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    } catch (firstError) {
      try {
        decoded = jwt.verify(token, config.JWT_GUEST_SECRET, { algorithms: ['HS256'] }) as GuestJwtPayload;
      } catch {
        if (firstError instanceof jwt.TokenExpiredError) {
          throw new UnauthorizedError('Token expirado');
        }
        throw new UnauthorizedError('Token inválido');
      }
    }

    if (isSseToken(decoded)) {
      throw new UnauthorizedError('Token inválido');
    }

    if ('isGuest' in decoded && (decoded as GuestJwtPayload).isGuest) {
      throw new UnauthorizedError('Los tokens de invitado no tienen acceso a esta funcionalidad');
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
    next(error);
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
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

    let decoded: JwtPayload | GuestJwtPayload;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    } catch (firstError) {
      try {
        decoded = jwt.verify(token, config.JWT_GUEST_SECRET, { algorithms: ['HS256'] }) as GuestJwtPayload;
      } catch {
        if (firstError instanceof jwt.TokenExpiredError) {
          throw new UnauthorizedError('Token expirado');
        }
        throw new UnauthorizedError('Token inválido');
      }
    }

    if (isSseToken(decoded)) {
      next();
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      isGuest: 'isGuest' in decoded && (decoded as GuestJwtPayload).isGuest,
    };

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

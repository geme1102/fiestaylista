import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { JwtPayload, GuestJwtPayload } from '../types/index.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
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
      decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    } catch {
      try {
        decoded = jwt.verify(token, config.JWT_GUEST_SECRET) as GuestJwtPayload;
      } catch {
        throw new UnauthorizedError('Token inválido');
      }
    }

    if ('isGuest' in decoded && (decoded as GuestJwtPayload).isGuest) {
      throw new UnauthorizedError('Los tokens de invitado no tienen acceso a esta funcionalidad');
    }

    (req as any).user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token inválido'));
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expirado'));
      return;
    }
    next(error);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
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
      decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    } catch {
      try {
        decoded = jwt.verify(token, config.JWT_GUEST_SECRET) as GuestJwtPayload;
      } catch {
        next();
        return;
      }
    }

    (req as any).user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch {
    next();
  }
}

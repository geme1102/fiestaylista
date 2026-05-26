import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import type { AuthRequest } from '../types/index.js';

export function audit(action: string, resource: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
    const ip = typeof req.ip === 'string' ? req.ip : (req.socket.remoteAddress ?? null);
    try {
      await db.insert(auditLogs).values({
        userId: authReq.user?.userId ?? null,
        action,
        resource,
        resourceId: String(req.params.id ?? ''),
        ipAddress: ip,
        userAgent: ua,
      });
    } catch {
      // Silently fail - audit should never break the app
    }
    next();
  };
}

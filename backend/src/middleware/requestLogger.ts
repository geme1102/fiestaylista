import type { Request, Response, NextFunction } from 'express';
import type { AppRequest } from '../types/index.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const appReq = req as AppRequest;

    const logEntry: Record<string, unknown> = {
      type: 'request',
      requestId: appReq.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '-',
    };

    if (appReq.user?.userId) {
      logEntry.userId = appReq.user.userId;
    }

    console.log(JSON.stringify(logEntry));
  });

  next();
}

import type { Request, Response, NextFunction } from 'express';
import type { AppRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const appReq = req as AppRequest;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    const logData: Record<string, unknown> = {
      requestId: appReq.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    };

    if (appReq.user?.userId) {
      logData.userId = appReq.user.userId;
    }

    logger[level](logData, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}

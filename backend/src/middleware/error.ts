import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { config } from '../config.js';

function logError(err: Error, errorId: string, req?: Request): void {
  const errorLog: Record<string, unknown> = {
    errorId,
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    error: err.message,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    name: err.name,
  };

  if (req) {
    errorLog.method = req.method;
    errorLog.path = req.path;
    errorLog.ip = req.ip;
    errorLog.userId = (req as any).user?.userId;
  }

  console.error(JSON.stringify(errorLog));
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const errorId = randomUUID();

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logError(err, errorId, req);
    }
    res.status(err.statusCode).json({ error: err.message, errorId });
    return;
  }

  logError(err, errorId, req);

  res.status(500).json({ error: 'Error interno del servidor', errorId });
}

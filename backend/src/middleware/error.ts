import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { config } from '../config.js';
import { formatZodError } from '../utils/zodErrors.js';

function logError(err: Error, req?: Request): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    error: err.message,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    name: err.name,
  };

  if (req) {
    Object.assign(errorLog, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: (req as any).user?.userId,
    });
  }

  console.error(JSON.stringify(errorLog));
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: formatZodError(err) });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logError(err, req);
    }
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logError(err, req);

  res.status(500).json({ error: 'Error interno del servidor' });
}

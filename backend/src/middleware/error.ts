import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

function logError(err: unknown, errorId: string, req?: Request): void {
  const errMessage = err instanceof Error ? err.message : 'Error interno';
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const logData: Record<string, unknown> = {
    errorId,
    err: errMessage,
    statusCode,
  };

  if (req) {
    logData.method = req.method;
    logData.path = req.path;
    logData.ip = req.ip;
    logData.userId = (req as AuthRequest).user?.userId;
  }

  logger.error(logData, errMessage);
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }

  const errorId = randomUUID();

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logError(err, errorId, req);
    }
    res.status(err.statusCode).json({ error: err.message, errorId });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    logError(err, errorId, req);
    res.status(400).json({ error: 'JSON inválido en el cuerpo de la solicitud', errorId });
    return;
  }

  logError(err, errorId, req);

  const errMsg = err instanceof Error ? err.message : 'Error desconocido';
  const isProd = config.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Error interno del servidor',
    errorId,
    ...(isProd ? {} : { detail: errMsg.slice(0, 300) }),
  });
}

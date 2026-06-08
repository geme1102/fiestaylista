import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { config } from '../config.js';

function toSerializable(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const obj: Record<string, unknown> = { message: err.message, name: err.name };
    if (config.NODE_ENV === 'development') obj.stack = err.stack;
    for (const key of Object.keys(err as any)) {
      if (!['message', 'name', 'stack'].includes(key)) {
        try { obj[key] = JSON.parse(JSON.stringify((err as any)[key])); } catch { obj[key] = String((err as any)[key]); }
      }
    }
    return obj;
  }
  if (typeof err === 'object' && err !== null) {
    try { return JSON.parse(JSON.stringify(err)); } catch { return { value: String(err) }; }
  }
  return { value: String(err) };
}

function logError(err: unknown, errorId: string, req?: Request): void {
  const errorLog: Record<string, unknown> = {
    errorId,
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    error: toSerializable(err),
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

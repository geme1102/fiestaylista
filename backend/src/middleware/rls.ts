import type { Response, NextFunction } from 'express';
import { sql } from '../db/index.js';
import type { AuthRequest } from '../types/index.js';

let warnLogged = false;

export async function applyRLSContext(userId?: string, eventId?: string): Promise<void> {
  try {
    await sql`SET app.current_user_id = ${userId ?? ''}`;
    await sql`SET app.current_event_id = ${eventId ?? ''}`;
  } catch {
    if (!warnLogged) {
      warnLogged = true;
      console.warn('[RLS] No se pudo establecer contexto RLS — las políticas pueden no estar activas');
    }
  }
}

export async function setRLSContext(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  await applyRLSContext(req.user?.userId, req.params.eventId);
  next();
}

export async function clearRLSContext(): Promise<void> {
  try {
    await sql`SET app.current_user_id = ''`;
    await sql`SET app.current_event_id = ''`;
  } catch {}
}

import type { Response, NextFunction } from 'express';
import { sql } from '../db/index.js';
import type { AuthRequest } from '../types/index.js';

let warnLogged = false;

export async function setRLSContext(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;

  try {
    if (userId) {
      await sql`SET app.current_user_id = ${userId}`;
    } else {
      await sql`SET app.current_user_id = ''`;
    }

    if (req.params.eventId && req.user) {
      await sql`SET app.current_event_id = ${req.params.eventId}`;
    } else {
      await sql`SET app.current_event_id = ''`;
    }
  } catch {
    if (!warnLogged) {
      warnLogged = true;
      console.warn('[RLS] No se pudo establecer app.current_user_id — RLS puede no estar activo');
    }
  }

  next();
}

export async function clearRLSContext(): Promise<void> {
  try {
    await sql`SET app.current_user_id = ''`;
    await sql`SET app.current_event_id = ''`;
  } catch {}
}

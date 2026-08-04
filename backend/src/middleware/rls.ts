import { sql } from '../db/index.js';

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

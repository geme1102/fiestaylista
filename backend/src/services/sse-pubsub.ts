import { sql } from '../db/index.js';
import { createModuleLogger } from '../utils/logger.js';
import { broadcastToClients } from './notifications.js';

const log = createModuleLogger('SSEPubSub');

const CHANNEL = 'sse_events';

let unlistenFn: (() => Promise<void>) | null = null;

export async function startSSEListener(): Promise<void> {
  try {
    const handle = await sql.listen(CHANNEL, (payload: string) => {
      try {
        const { eventId, type, data } = JSON.parse(payload) as { eventId: string; type: string; data: Record<string, unknown> };
        broadcastToClients(eventId, { type, ...data });
      } catch (err) {
        log.error({ err, payload }, 'Error procesando notificación SSE pub/sub');
      }
    });
    unlistenFn = handle.unlisten;
    log.info({ channel: CHANNEL }, 'SSE pub/sub listener iniciado');
  } catch (err) {
    log.error({ err }, 'Error iniciando SSE pub/sub listener — modo local-only');
  }
}

export async function stopSSEListener(): Promise<void> {
  if (unlistenFn) {
    try {
      await unlistenFn();
    } catch (err) {
      log.error({ err }, 'Error deteniendo SSE pub/sub listener');
    }
    unlistenFn = null;
  }
}

export async function notifyEvent(eventId: string, type: string, data: Record<string, unknown>): Promise<void> {
  try {
    await sql.notify(CHANNEL, JSON.stringify({ eventId, type, data }));
  } catch (err) {
    log.error({ err }, 'Error notificando evento SSE via pub/sub');
  }
}

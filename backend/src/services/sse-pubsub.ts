import { sql } from '../db/index.js';
import { createModuleLogger } from '../utils/logger.js';
import { broadcastToClients } from './notifications.js';

const log = createModuleLogger('SSEPubSub');

const CHANNEL = 'sse_events';
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 120000;

let unlistenFn: (() => Promise<void>) | null = null;
let healthTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatSenderTimer: ReturnType<typeof setInterval> | null = null;
let lastHeartbeat = 0;

export async function startSSEListener(): Promise<void> {
  try {
    const handle = await sql.listen(CHANNEL, (payload: string) => {
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        if (parsed.type === '__heartbeat__') {
          lastHeartbeat = Date.now();
          return;
        }
        const { eventId, type, data } = parsed as { eventId: string; type: string; data: Record<string, unknown> };
        broadcastToClients(eventId, { type, ...data });
      } catch (err) {
        log.error({ err, payload }, 'Error procesando notificación SSE pub/sub');
      }
    });
    unlistenFn = handle.unlisten;
    lastHeartbeat = Date.now();
    log.info({ channel: CHANNEL }, 'SSE pub/sub listener iniciado');
    startHealthCheck();
  } catch (err) {
    log.error({ err }, 'Error iniciando SSE pub/sub listener — reintentando en 10s...');
    setTimeout(() => startSSEListener(), 10000);
  }
}

export function startHeartbeatSender(): void {
  if (heartbeatSenderTimer) return;
  heartbeatSenderTimer = setInterval(() => {
    notifyEvent('__system__', '__heartbeat__', {}).catch(() => {});
  }, HEARTBEAT_INTERVAL);
}

function startHealthCheck(): void {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = setInterval(() => {
    if (Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT) {
      log.warn('SSE pub/sub heartbeat perdido — reconectando...');
      restartSSEListener();
    }
  }, HEARTBEAT_INTERVAL);
}

async function restartSSEListener(): Promise<void> {
  cleanupHealthCheck();
  if (unlistenFn) {
    try { await unlistenFn(); } catch {} 
    unlistenFn = null;
  }
  await startSSEListener();
}

function cleanupHealthCheck(): void {
  if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
}

export async function stopSSEListener(): Promise<void> {
  cleanupHealthCheck();
  if (heartbeatSenderTimer) { clearInterval(heartbeatSenderTimer); heartbeatSenderTimer = null; }
  if (unlistenFn) {
    try { await unlistenFn(); } catch (err) { log.error({ err }, 'Error deteniendo SSE pub/sub listener'); }
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

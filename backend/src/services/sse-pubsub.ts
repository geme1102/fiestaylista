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
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastHeartbeat = 0;
// D7-M: backoff exponencial del listener (10s→60s, cap). Antes reintentaba cada
// 10s fijos e infinitos con 1 log.error por intento: con Neon caído eran
// ~8.600 líneas/día por instancia, justo cuando más claridad se necesita.
let retryCount = 0;
const RETRY_BASE_MS = 10_000;
const RETRY_MAX_MS = 60_000;

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
    retryCount = 0;
    log.info({ channel: CHANNEL }, 'SSE pub/sub listener iniciado');
    startHealthCheck();
  } catch (err) {
    const delay = Math.min(RETRY_BASE_MS * Math.pow(2, retryCount), RETRY_MAX_MS);
    retryCount++;
    log.error({ err, attempt: retryCount, nextRetryMs: delay }, 'Error iniciando SSE pub/sub listener — reintentando con backoff');
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      startSSEListener();
    }, delay);
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
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  const oldUnlisten = unlistenFn;
  unlistenFn = null;
  await startSSEListener();
  if (oldUnlisten) {
    try { await oldUnlisten(); } catch {}
  }
}

function cleanupHealthCheck(): void {
  if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
}

export async function stopSSEListener(): Promise<void> {
  cleanupHealthCheck();
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
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

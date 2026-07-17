import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Notifications');

interface GiftClaimedEvent {
  eventId: string;
  giftId: string;
  giftName: string;
  claimedBy: string;
  claims?: Array<{ id: string; claimedBy: string }>;
  timestamp: string;
}

interface MessagePostedEvent {
  eventId: string;
  authorName: string;
  messagePreview: string;
  timestamp: string;
}

interface CashContributionEvent {
  eventId: string;
  contributorName: string;
  amount: number;
  type: 'created' | 'cancelled';
  timestamp: string;
}

interface PhotoUploadedEvent {
  eventId: string;
  photoUrl: string;
  uploadedBy: string;
  timestamp: string;
}

// SSE client management with delivery buffer, half-open detection, and per-IP limits
const clients = new Map<string, Set<Response>>();
const clientActivity = new WeakMap<Response, number>();
const deliveryBuffer = new Map<Response, string[]>();
const MAX_BUFFER_SIZE = 20;

const ipCount = new Map<string, number>();
const clientIps = new Map<Response, string>();

export function incrementClientIp(res: Response, ip: string): void {
  clientIps.set(res, ip);
  ipCount.set(ip, (ipCount.get(ip) ?? 0) + 1);
}

export function decrementClientIp(res: Response): void {
  const ip = clientIps.get(res);
  if (ip) {
    const current = ipCount.get(ip) ?? 0;
    if (current <= 1) {
      ipCount.delete(ip);
    } else {
      ipCount.set(ip, current - 1);
    }
    clientIps.delete(res);
  }
}

export function getClientIpCount(ip: string): number {
  return ipCount.get(ip) ?? 0;
}

function touchClient(res: Response): void {
  clientActivity.set(res, Date.now());
}

export function subscribeClient(eventId: string, res: Response): void {
  if (!clients.has(eventId)) {
    clients.set(eventId, new Set());
  }
  clients.get(eventId)!.add(res);
  touchClient(res);
  // Flush any buffered messages
  const buf = deliveryBuffer.get(res);
  if (buf) {
    for (const msg of buf) {
      try { res.write(msg); } catch (err) { log.error({ err }, 'Error escribiendo mensaje SSE almacenado'); break; }
    }
    deliveryBuffer.delete(res);
  }
}

export function unsubscribeClient(eventId: string, res: Response): void {
  const eventClients = clients.get(eventId);
  if (eventClients) {
    eventClients.delete(res);
    if (eventClients.size === 0) {
      clients.delete(eventId);
    }
  }
  decrementClientIp(res);
  deliveryBuffer.delete(res);
  clientActivity.delete(res);
}

export function getClientCount(eventId: string): number {
  return clients.get(eventId)?.size ?? 0;
}

export function getTotalClientCount(): number {
  let total = 0;
  for (const eventClients of clients.values()) {
    total += eventClients.size;
  }
  return total;
}

function broadcastToClients(eventId: string, data: Record<string, unknown>): void {
  const eventClients = clients.get(eventId);
  if (!eventClients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of eventClients) {
    try {
      client.write(payload);
      touchClient(client);
    } catch (err) {
      log.warn({ err }, 'Error en broadcast SSE — encolando para reintento');
      let buf = deliveryBuffer.get(client);
      if (!buf) {
        buf = [];
        deliveryBuffer.set(client, buf);
      }
      if (buf.length < MAX_BUFFER_SIZE) {
        buf.push(payload);
      }
    }
  }
}

function retryBuffered(res: Response): void {
  const buf = deliveryBuffer.get(res);
  if (!buf || buf.length === 0) return;
  const remaining: string[] = [];
  for (const msg of buf) {
    try {
      res.write(msg);
      touchClient(res);
    } catch (err) {
      log.warn({ err }, 'Error en reintento SSE — manteniendo en buffer');
      remaining.push(msg);
    }
  }
  if (remaining.length > 0) {
    deliveryBuffer.set(res, remaining);
  } else {
    deliveryBuffer.delete(res);
  }
}

// Emitter for async extensibility
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emitGiftClaimed(data: GiftClaimedEvent): void {
  try {
    const payload: Record<string, unknown> = {
      giftId: data.giftId,
      giftName: data.giftName,
      claimedBy: data.claimedBy,
      type: 'gift:claimed',
    };
    if (data.claims) {
      payload.claims = data.claims;
    }
    emitter.emit(`gift:claimed:${data.eventId}`, data);
    broadcastToClients(data.eventId, payload);
  } catch (err) {
    log.error({ err }, 'Error emitiendo evento gift:claimed');
  }
}

export function emitMessagePosted(data: MessagePostedEvent): void {
  try {
    emitter.emit(`message:posted:${data.eventId}`, data);
    broadcastToClients(data.eventId, {
      type: 'message:posted',
      authorName: data.authorName,
      messagePreview: data.messagePreview,
    });
  } catch (err) {
    log.error({ err }, 'Error emitiendo evento message:posted');
  }
}

export function emitPhotoUploaded(data: PhotoUploadedEvent): void {
  try {
    emitter.emit(`photo:uploaded:${data.eventId}`, data);
    broadcastToClients(data.eventId, {
      type: 'photo:uploaded',
      uploadedBy: data.uploadedBy,
      photoUrl: data.photoUrl,
    });
  } catch (err) {
    log.error({ err }, 'Error emitiendo evento photo:uploaded');
  }
}

export function emitCashContribution(data: CashContributionEvent): void {
  try {
    emitter.emit(`cash:contribution:${data.eventId}`, data);
    broadcastToClients(data.eventId, {
      type: 'cash:contribution',
      contributorName: data.contributorName,
      amount: data.amount,
      contributionType: data.type,
    });
  } catch (err) {
    log.error({ err }, 'Error emitiendo evento cash:contribution');
  }
}

// SSE scavenger: cleanup abandoned connections + retry buffer
const SSE_SCAVENGER_INTERVAL_MS = 60 * 1000;
const SSE_HALF_OPEN_TIMEOUT_MS = 90 * 1000;
let scavengerTimer: ReturnType<typeof setInterval> | null = null;

export function startSSEScavenger(): void {
  if (scavengerTimer) return;
  scavengerTimer = setInterval(() => {
    const now = Date.now();
    for (const [eventId, eventClients] of clients) {
      for (const client of eventClients) {
        // Retry buffered messages
        retryBuffered(client);
        // Detect half-open connections
        const lastActive = clientActivity.get(client);
        if (lastActive === undefined || (now - lastActive) > SSE_HALF_OPEN_TIMEOUT_MS) {
          try {
            client.end();
          } catch (err) {
            log.warn({ err }, 'Error cerrando conexión SSE');
          }
          decrementClientIp(client);
          eventClients.delete(client);
          deliveryBuffer.delete(client);
          clientActivity.delete(client);
          continue;
        }
        // Ping to detect dead connections
        try {
          client.write(':ping\n\n');
          touchClient(client);
        } catch (err) {
          log.warn({ err }, 'Error en ping SSE — eliminando cliente');
          decrementClientIp(client);
          eventClients.delete(client);
          deliveryBuffer.delete(client);
          clientActivity.delete(client);
        }
      }
      if (eventClients.size === 0) {
        clients.delete(eventId);
      }
    }
  }, SSE_SCAVENGER_INTERVAL_MS);
}

export function stopSSEScavenger(): void {
  if (scavengerTimer) {
    clearInterval(scavengerTimer);
    scavengerTimer = null;
  }
}

export { emitter, clients };
export type { GiftClaimedEvent, MessagePostedEvent, CashContributionEvent, PhotoUploadedEvent };

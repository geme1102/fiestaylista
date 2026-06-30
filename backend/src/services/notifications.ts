import { EventEmitter } from 'node:events';
import type { Response } from 'express';

interface GiftClaimedEvent {
  eventId: string;
  giftId: string;
  giftName: string;
  claimedBy: string;
  timestamp: string;
}

interface MessagePostedEvent {
  eventId: string;
  authorName: string;
  messagePreview: string;
  timestamp: string;
}

interface PhotoUploadedEvent {
  eventId: string;
  photoUrl: string;
  uploadedBy: string;
  timestamp: string;
}

// SSE client management
const clients = new Map<string, Set<Response>>();

export function subscribeClient(eventId: string, res: Response): void {
  if (!clients.has(eventId)) {
    clients.set(eventId, new Set());
  }
  clients.get(eventId)!.add(res);
}

export function unsubscribeClient(eventId: string, res: Response): void {
  const eventClients = clients.get(eventId);
  if (eventClients) {
    eventClients.delete(res);
    if (eventClients.size === 0) {
      clients.delete(eventId);
    }
  }
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
    try { client.write(payload); } catch { /* cliente desconectado */ }
  }
}

// Emitter for async extensibility
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emitGiftClaimed(data: GiftClaimedEvent): void {
  try {
    emitter.emit(`gift:claimed:${data.eventId}`, data);
    broadcastToClients(data.eventId, {
      giftId: data.giftId,
      giftName: data.giftName,
      claimedBy: data.claimedBy,
      type: 'gift:claimed',
    });
  } catch {
    // no interrumpir el flujo principal
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
  } catch {
    // no-op
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
  } catch {
    // no-op
  }
}

// SSE scavenger: cleanup abandoned connections
const SSE_SCAVENGER_INTERVAL_MS = 2 * 60 * 1000;
let scavengerTimer: ReturnType<typeof setInterval> | null = null;

export function startSSEScavenger(): void {
  if (scavengerTimer) return;
  scavengerTimer = setInterval(() => {
    for (const [eventId, eventClients] of clients) {
      for (const client of eventClients) {
        try {
          client.write(':ping\n\n');
        } catch {
          eventClients.delete(client);
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
export type { GiftClaimedEvent, MessagePostedEvent, PhotoUploadedEvent };

import { EventEmitter } from 'node:events';

interface GiftClaimedEvent {
  eventId: string;
  giftId: string;
  giftName: string;
  claimedBy: string;
  timestamp: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emitGiftClaimed(data: GiftClaimedEvent): void {
  try {
    emitter.emit(`gift:claimed:${data.eventId}`, data);
  } catch {
    // Los listeners (SSE, etc.) no deben interrumpir el flujo principal
  }
}



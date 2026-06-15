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
  emitter.emit(`gift:claimed:${data.eventId}`, data);
}



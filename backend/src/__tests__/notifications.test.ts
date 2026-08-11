import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';

vi.mock('./sse-pubsub.js', () => ({
  notifyEvent: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() }),
}));

import {
  subscribeClient,
  unsubscribeClient,
  broadcastToClients,
  startSSEScavenger,
  stopSSEScavenger,
  getClientCount,
  incrementClientIp,
  getClientIpCount,
} from '../services/notifications.js';

function makeClient(socket?: { readableEnded?: boolean; destroyed?: boolean }) {
  return {
    write: vi.fn(() => true),
    end: vi.fn(),
    socket: socket ?? { readableEnded: false, destroyed: false },
  } as unknown as Response;
}

const SCAVENGER_MS = 15_000;

beforeEach(() => {
  vi.useFakeTimers();
  startSSEScavenger();
});

afterEach(() => {
  stopSSEScavenger();
  vi.useRealTimers();
});

describe('SSE scavenger (D3-M7)', () => {
  it('el ping NO refresca lastActivity — un cliente idle se cierra tras el timeout', () => {
    const client = makeClient();
    subscribeClient('evt-idle', client);

    vi.advanceTimersByTime(SCAVENGER_MS);
    expect(client.write).toHaveBeenCalledWith(':ping\n\n');
    expect(client.end).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SCAVENGER_MS * 6);
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(getClientCount('evt-idle')).toBe(0);
  });

  it('un socket half-open (peer cerró: readableEnded) se cierra en el primer run sin esperar el timeout', () => {
    const client = makeClient({ readableEnded: true });
    incrementClientIp(client, '1.2.3.4');
    subscribeClient('evt-half', client);
    expect(getClientIpCount('1.2.3.4')).toBe(1);

    vi.advanceTimersByTime(SCAVENGER_MS);

    expect(client.end).toHaveBeenCalledTimes(1);
    expect(getClientCount('evt-half')).toBe(0);
    expect(getClientIpCount('1.2.3.4')).toBe(0);
  });

  it('un socket destroyed también se considera half-open y se cierra', () => {
    const client = makeClient({ destroyed: true });
    subscribeClient('evt-destroyed', client);

    vi.advanceTimersByTime(SCAVENGER_MS);

    expect(client.end).toHaveBeenCalledTimes(1);
    expect(getClientCount('evt-destroyed')).toBe(0);
  });

  it('un cliente con actividad real (broadcast) no se cierra pese al tiempo', () => {
    const client = makeClient();
    subscribeClient('evt-activo', client);

    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(SCAVENGER_MS * 5);
      broadcastToClients('evt-activo', { giftId: 'g-1' });
    }

    expect(client.end).not.toHaveBeenCalled();
    expect(getClientCount('evt-activo')).toBe(1);
  });

  it('unsubscribeClient sigue limpiando el cliente y su IP', () => {
    const client = makeClient();
    incrementClientIp(client, '5.6.7.8');
    subscribeClient('evt-unsub', client);
    expect(getClientIpCount('5.6.7.8')).toBe(1);

    unsubscribeClient('evt-unsub', client);

    expect(getClientCount('evt-unsub')).toBe(0);
    expect(getClientIpCount('5.6.7.8')).toBe(0);
    expect(client.end).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockApiPost = vi.fn();
vi.mock('../services/api', () => ({
  apiClient: { post: mockApiPost },
}));

let esInstances: MockEventSource[] = [];

class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    esInstances.push(this);
  }

  close() { this.readyState = 2; }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  sendMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError() {
    this.readyState = 2;
    this.onerror?.();
  }
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  esInstances = [];
  mockApiPost.mockReset();
  mockApiPost.mockResolvedValue({ token: 'sse-token-123' });
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function waitForES(): Promise<MockEventSource> {
  await waitFor(() => expect(esInstances.length).toBeGreaterThanOrEqual(1));
  return esInstances[esInstances.length - 1];
}

describe('useSSE', () => {
  it('fetches token and connects to SSE stream', async () => {
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token' }));

    await waitForES();

    expect(mockApiPost).toHaveBeenCalledWith('/api/sse/token');
    expect(esInstances[0].url).toContain('/api/events/evt-1/gifts/subscribe');
    expect(esInstances[0].url).toContain('token=sse-token-123');
  });

  it('calls onGiftClaimed when receiving gift:claimed event', async () => {
    const onGiftClaimed = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onGiftClaimed }));

    const es = await waitForES();
    es.simulateOpen();
    es.sendMessage({ type: 'gift:claimed', giftId: 'g-1', giftName: 'Olla', claimedBy: 'Maria' });

    expect(onGiftClaimed).toHaveBeenCalledWith({ giftId: 'g-1', giftName: 'Olla', claimedBy: 'Maria' });
  });

  it('calls onMessagePosted when receiving message:posted event', async () => {
    const onMessagePosted = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onMessagePosted }));

    const es = await waitForES();
    es.simulateOpen();
    es.sendMessage({ type: 'message:posted', authorName: 'Juan', messagePreview: 'Felicidades' });

    expect(onMessagePosted).toHaveBeenCalledWith({ authorName: 'Juan', messagePreview: 'Felicidades' });
  });

  it('calls onPhotoUploaded when receiving photo:uploaded event', async () => {
    const onPhotoUploaded = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onPhotoUploaded }));

    const es = await waitForES();
    es.simulateOpen();
    es.sendMessage({ type: 'photo:uploaded', photoUrl: 'https://cdn.test/photo.jpg', uploadedBy: 'Ana' });

    expect(onPhotoUploaded).toHaveBeenCalledWith({ photoUrl: 'https://cdn.test/photo.jpg', uploadedBy: 'Ana' });
  });

  it('handles multiple messages in sequence', async () => {
    const onGiftClaimed = vi.fn();
    const onMessagePosted = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onGiftClaimed, onMessagePosted }));

    const es = await waitForES();
    es.simulateOpen();
    es.sendMessage({ type: 'gift:claimed', giftId: 'g-1', giftName: 'Olla', claimedBy: 'Maria' });
    es.sendMessage({ type: 'message:posted', authorName: 'Luis', messagePreview: 'Hola' });

    expect(onGiftClaimed).toHaveBeenCalledWith({ giftId: 'g-1', giftName: 'Olla', claimedBy: 'Maria' });
    expect(onMessagePosted).toHaveBeenCalledWith({ authorName: 'Luis', messagePreview: 'Hola' });
  });

  it('reconnects on error', async () => {
    const onConnected = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onConnected, maxRetries: 5, initialRetryDelay: 50 }));

    const es1 = await waitForES();
    es1.simulateError();

    await waitFor(() => expect(esInstances.length).toBe(2));
    esInstances[1].simulateOpen();

    expect(onConnected).toHaveBeenCalled();
  });

  it('cleanup on unmount closes EventSource', async () => {
    const { useSSE } = await import('../hooks/useSSE');
    const { unmount } = renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token' }));

    const es = await waitForES();
    es.simulateOpen();
    unmount();

    expect(es.readyState).toBe(2);
  });

  it('does not connect when eventId is empty', async () => {
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: '', sseTokenEndpoint: '/api/sse/token' }));

    await vi.waitFor(() => {
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  it('handles fallback legacy gift format without type field', async () => {
    const onGiftClaimed = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onGiftClaimed }));

    const es = await waitForES();
    es.simulateOpen();
    es.sendMessage({ giftId: 'g-2', giftName: 'Vaso', claimedBy: 'Pedro' });

    expect(onGiftClaimed).toHaveBeenCalledWith({ giftId: 'g-2', giftName: 'Vaso', claimedBy: 'Pedro' });
  });

  it('ignores malformed SSE data', async () => {
    const onGiftClaimed = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onGiftClaimed }));

    const es = await waitForES();
    es.simulateOpen();
    es.onmessage?.({ data: 'not-json' } as MessageEvent);
    es.sendMessage({ type: 'gift:claimed', giftId: 'g-1', giftName: 'X', claimedBy: 'M' });

    expect(onGiftClaimed).toHaveBeenCalledWith(expect.objectContaining({ giftId: 'g-1' }));
  });

  it('handles reconnect event from server', async () => {
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', maxRetries: 50, initialRetryDelay: 50 }));

    const es = await waitForES();
    es.simulateOpen();
    es.sendMessage({ type: 'reconnect' });

    await waitFor(() => expect(esInstances.length).toBe(2));
    expect(esInstances[0].readyState).toBe(2);
  });

  it('envía el token Turnstile en el body del POST cuando hay provider', async () => {
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({
      eventId: 'evt-1',
      sseTokenEndpoint: '/api/public/sse/token',
      turnstileTokenProvider: () => 'turnstile-tok-1',
    }));

    await waitForES();

    expect(mockApiPost).toHaveBeenCalledWith('/api/public/sse/token', { turnstileToken: 'turnstile-tok-1' });
  });

  it('pide un token fresco tras el POST exitoso (single-use)', async () => {
    const onRefresh = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({
      eventId: 'evt-1',
      sseTokenEndpoint: '/api/public/sse/token',
      turnstileTokenProvider: () => 'turnstile-tok-1',
      onTurnstileTokenRefreshed: onRefresh,
    }));

    await waitForES();

    expect(onRefresh).toHaveBeenCalled();
  });

  it('pide un token fresco tras error del POST (posible consumo por un claim)', async () => {
    const onRefresh = vi.fn();
    mockApiPost.mockRejectedValueOnce(new Error('Token de seguridad requerido'));
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({
      eventId: 'evt-1',
      sseTokenEndpoint: '/api/public/sse/token',
      turnstileTokenProvider: () => 'turnstile-tok-1',
      onTurnstileTokenRefreshed: onRefresh,
      maxRetries: 0,
    }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('no postea sin token Turnstile y se desconecta (fallback al polling)', async () => {
    const onDisconnected = vi.fn();
    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({
      eventId: 'evt-1',
      sseTokenEndpoint: '/api/public/sse/token',
      turnstileTokenProvider: () => null,
      maxRetries: 0,
      onDisconnected,
    }));

    // 25 intentos × 200ms de espera ≈ 5s antes de rendirse
    await waitFor(() => expect(onDisconnected).toHaveBeenCalled(), { timeout: 7000 });

    expect(mockApiPost).not.toHaveBeenCalled();
    expect(esInstances.length).toBe(0);
  }, 10000);
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

function createSSEChunk(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

const mockGetAccessToken = vi.fn((): string | null => null);
vi.mock('../services/api', () => ({
  getAccessToken: mockGetAccessToken,
}));

let fetchCalls: { url: string; options: RequestInit }[] = [];

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  fetchCalls = [];
  mockGetAccessToken.mockReturnValue(null);
  globalThis.TextDecoder = TextDecoder;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function mockFetchSequence(...responses: unknown[]) {
  let idx = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url: string | URL | Request, options?: RequestInit) => {
      fetchCalls.push({ url: url.toString(), options: options ?? {} });
      const resp = responses[idx];
      idx++;
      if (resp instanceof Error) throw resp;
      if (resp instanceof ReadableStream) {
        return {
          ok: true,
          body: resp,
        } as Response;
      }
      return {
        ok: true,
        json: () => Promise.resolve(resp),
      } as Response;
    }
  );
}

describe('useSSE', () => {
  it('fetches token and connects to SSE stream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(createSSEChunk({ type: 'connected' }));
        controller.close();
      },
    });
    mockFetchSequence({ token: 'sse-token-123' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token' }));

    await waitFor(() => {
      expect(fetchCalls.length).toBe(2);
    });
    expect(fetchCalls[0].url).toContain('/api/sse/token');
    expect(fetchCalls[1].url).toContain('/api/events/evt-1/gifts/subscribe');
  });

  it('calls onGiftClaimed when receiving gift:claimed event', async () => {
    const onGiftClaimed = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(createSSEChunk({ type: 'gift:claimed', giftId: 'g-1', giftName: 'Olla', claimedBy: 'Maria' }));
        controller.close();
      },
    });
    mockFetchSequence({ token: 'tok' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onGiftClaimed }));

    await waitFor(() => {
      expect(onGiftClaimed).toHaveBeenCalledWith({ giftId: 'g-1', giftName: 'Olla', claimedBy: 'Maria' });
    });
  });

  it('calls onMessagePosted when receiving message:posted event', async () => {
    const onMessagePosted = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(createSSEChunk({ type: 'message:posted', authorName: 'Juan', messagePreview: 'Felicidades' }));
        controller.close();
      },
    });
    mockFetchSequence({ token: 'tok' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onMessagePosted }));

    await waitFor(() => {
      expect(onMessagePosted).toHaveBeenCalledWith({ authorName: 'Juan', messagePreview: 'Felicidades' });
    });
  });

  it('calls onPhotoUploaded when receiving photo:uploaded event', async () => {
    const onPhotoUploaded = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(createSSEChunk({ type: 'photo:uploaded', photoUrl: 'https://cdn.test/photo.jpg', uploadedBy: 'Ana' }));
        controller.close();
      },
    });
    mockFetchSequence({ token: 'tok' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onPhotoUploaded }));

    await waitFor(() => {
      expect(onPhotoUploaded).toHaveBeenCalledWith({ photoUrl: 'https://cdn.test/photo.jpg', uploadedBy: 'Ana' });
    });
  });

  it('handles buffer across multiple read chunks', async () => {
    const onMessagePosted = vi.fn();
    const chunks = [
      'data: {"type":"message:',
      'posted","authorName":"Luis","messagePreview":"Hola"}\n\n',
    ];
    let chunkIdx = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (chunkIdx < chunks.length) {
          controller.enqueue(new TextEncoder().encode(chunks[chunkIdx++]));
        } else {
          controller.close();
        }
      },
    });
    mockFetchSequence({ token: 'tok' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() =>
      useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onMessagePosted })
    );

    await waitFor(() => {
      expect(onMessagePosted).toHaveBeenCalledWith({ authorName: 'Luis', messagePreview: 'Hola' });
    });
  });

  it('reconnects on connection failure with exponential backoff', async () => {
    vi.useFakeTimers();
    const onConnected = vi.fn();
    let failCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (failCount < 2) {
        failCount++;
        throw new Error('Connection failed');
      }
      return {
        ok: true,
        json: () => Promise.resolve({ token: 'tok' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(createSSEChunk({ type: 'connected' }));
            controller.close();
          },
        }),
      } as unknown as Response;
    });

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() =>
      useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onConnected, maxRetries: 5, initialRetryDelay: 1000 })
    );

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await vi.waitFor(() => {
      expect(onConnected).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });

  it('cleanup on unmount cancels reconnection and disconnects', async () => {
    const onDisconnected = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No connection'));
    vi.useFakeTimers();

    const { useSSE } = await import('../hooks/useSSE');
    const { unmount } = renderHook(() =>
      useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onDisconnected })
    );

    unmount();

    expect(onDisconnected).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not connect when eventId is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: '', sseTokenEndpoint: '/api/sse/token' }));

    await vi.waitFor(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('includes auth token in token endpoint request when available', async () => {
    mockGetAccessToken.mockReturnValue('auth-token-123');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(createSSEChunk({ type: 'connected' }));
        controller.close();
      },
    });
    mockFetchSequence({ token: 'sse-token' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token' }));

    await waitFor(() => {
      expect(fetchCalls[0].options.headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer auth-token-123' })
      );
    });
  });

  it('handles fallback legacy gift format without type field', async () => {
    const onGiftClaimed = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(createSSEChunk({ giftId: 'g-2', giftName: 'Vaso', claimedBy: 'Pedro' }));
        controller.close();
      },
    });
    mockFetchSequence({ token: 'tok' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onGiftClaimed }));

    await waitFor(() => {
      expect(onGiftClaimed).toHaveBeenCalledWith({ giftId: 'g-2', giftName: 'Vaso', claimedBy: 'Pedro' });
    });
  });

  it('ignores malformed SSE data', async () => {
    const onGiftClaimed = vi.fn();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: not-json\n\ndata: {"type":"gift:claimed","giftId":"g-1","claimedBy":"M"}\n\n'));
        controller.close();
      },
    });
    mockFetchSequence({ token: 'tok' }, stream);

    const { useSSE } = await import('../hooks/useSSE');
    renderHook(() => useSSE({ eventId: 'evt-1', sseTokenEndpoint: '/api/sse/token', onGiftClaimed }));

    await waitFor(() => {
      expect(onGiftClaimed).toHaveBeenCalledWith(expect.objectContaining({ giftId: 'g-1' }));
    });
  });
});

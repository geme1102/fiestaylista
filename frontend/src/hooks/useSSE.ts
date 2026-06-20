import { useEffect, useRef } from 'react';

interface SSEOptions {
  eventId: string;
  sseTokenEndpoint: string;
  onGiftClaimed?: (data: { giftId: string; giftName: string; claimedBy: string }) => void;
  maxRetries?: number;
  initialRetryDelay?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useSSE({ eventId, sseTokenEndpoint, onGiftClaimed, maxRetries = 5, initialRetryDelay = 1000, onConnected, onDisconnected }: SSEOptions) {
  const cancelledRef = useRef(false);
  const sseConnectedRef = useRef(false);
  const onGiftClaimedRef = useRef(onGiftClaimed);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  onGiftClaimedRef.current = onGiftClaimed;
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;

  useEffect(() => {
    if (!eventId) return;

    cancelledRef.current = false;
    let abortController: AbortController | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = initialRetryDelay;
    let retryCount = 0;

    async function connectSSE() {
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      try {
        const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
        const tokenRes = await fetch(`${baseUrl}${sseTokenEndpoint}`, { method: 'POST', credentials: 'include' });
        if (!tokenRes.ok || cancelledRef.current) return;
        let token: string;
        try { ({ token } = await tokenRes.json()); } catch { return; }

        if (cancelledRef.current) return;

        abortController = new AbortController();
        let response: Response;
        try {
          response = await fetch(`${baseUrl}/api/events/${eventId}/gifts/subscribe`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: abortController.signal,
          });
        } catch { return; }

        if (!response.ok || !response.body || cancelledRef.current) return;

        retryDelay = initialRetryDelay;
        retryCount = 0;
        sseConnectedRef.current = true;
        onConnectedRef.current?.();

        const decoder = new TextDecoder();
        let buffer = '';
        reader = response.body.getReader();

        while (!cancelledRef.current) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'connected') continue;
                if (data.giftId && data.claimedBy) {
                  onGiftClaimedRef.current?.({ giftId: data.giftId, giftName: data.giftName, claimedBy: data.claimedBy });
                }
              } catch { /* ignore parse errors */ }
            }
          }
        }
      } catch {
        try { reader?.cancel(); } catch { /* ignore cancel errors */ }
      }

      sseConnectedRef.current = false;
      onDisconnectedRef.current?.();

      if (!cancelledRef.current && retryCount < maxRetries) {
        retryCount++;
        reconnectTimeout = setTimeout(connectSSE, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }

    connectSSE();

    return () => {
      cancelledRef.current = true;
      sseConnectedRef.current = false;
      onDisconnectedRef.current?.();
      if (abortController) abortController.abort();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [eventId, sseTokenEndpoint, initialRetryDelay, maxRetries]);

  return sseConnectedRef;
}

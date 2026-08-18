import { useEffect, useRef } from 'react';
import { reportError } from '../lib/reportError';
import { apiClient } from '../services/api';

interface SSEOptions {
  eventId: string;
  sseTokenEndpoint: string;
  onGiftClaimed?: (data: { giftId: string; giftName: string; claimedBy: string; claims?: Array<{ id: string; claimedBy: string }> }) => void;
  onMessagePosted?: (data: { authorName: string; messagePreview: string }) => void;
  onPhotoUploaded?: (data: { photoUrl: string; uploadedBy: string }) => void;
  onCashContribution?: (data: { contributorName: string; amount: number; contributionType: 'created' | 'cancelled' }) => void;
  maxRetries?: number;
  initialRetryDelay?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
  // Solo endpoints públicos de invitados (POST /public-sse-token exige
  // verifyTurnstile estricto en backend). El token Turnstile es de un solo
  // uso: tras el POST (éxito o error por token ya consumido en un claim) se
  // invoca onTurnstileTokenRefreshed para que el widget emita uno fresco.
  turnstileTokenProvider?: () => string | null;
  onTurnstileTokenRefreshed?: () => void;
}

export function useSSE({
  eventId, sseTokenEndpoint, onGiftClaimed, onMessagePosted, onPhotoUploaded, onCashContribution,
  maxRetries = 10, initialRetryDelay = 1000, onConnected, onDisconnected,
  turnstileTokenProvider, onTurnstileTokenRefreshed,
}: SSEOptions) {
  const cancelledRef = useRef(false);
  const sseConnectedRef = useRef(false);
  const onGiftClaimedRef = useRef(onGiftClaimed);
  const onMessagePostedRef = useRef(onMessagePosted);
  const onPhotoUploadedRef = useRef(onPhotoUploaded);
  const onCashContributionRef = useRef(onCashContribution);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const turnstileTokenProviderRef = useRef(turnstileTokenProvider);
  const onTurnstileTokenRefreshedRef = useRef(onTurnstileTokenRefreshed);
  onGiftClaimedRef.current = onGiftClaimed;
  onMessagePostedRef.current = onMessagePosted;
  onPhotoUploadedRef.current = onPhotoUploaded;
  onCashContributionRef.current = onCashContribution;
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;
  turnstileTokenProviderRef.current = turnstileTokenProvider;
  onTurnstileTokenRefreshedRef.current = onTurnstileTokenRefreshed;

  useEffect(() => {
    if (!eventId) return;

    cancelledRef.current = false;
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = initialRetryDelay;
    let retryCount = 0;

    function handleMessage(data: Record<string, unknown>) {
      if (data.type === 'connected' || data.type === 'reconnect') return;
      if (data.type === 'gift:claimed' && data.giftId && data.claimedBy) {
        onGiftClaimedRef.current?.({ giftId: data.giftId as string, giftName: data.giftName as string, claimedBy: data.claimedBy as string, claims: data.claims as Array<{ id: string; claimedBy: string }> | undefined });
      } else if (data.type === 'cash:contribution') {
        onCashContributionRef.current?.({ contributorName: data.contributorName as string, amount: data.amount as number, contributionType: data.contributionType as 'created' | 'cancelled' });
      } else if (data.type === 'message:posted') {
        onMessagePostedRef.current?.({ authorName: data.authorName as string, messagePreview: data.messagePreview as string });
      } else if (data.type === 'photo:uploaded') {
        onPhotoUploadedRef.current?.({ photoUrl: data.photoUrl as string, uploadedBy: data.uploadedBy as string });
      } else if (data.giftId && data.claimedBy) {
        onGiftClaimedRef.current?.({ giftId: data.giftId as string, giftName: data.giftName as string, claimedBy: data.claimedBy as string, claims: data.claims as Array<{ id: string; claimedBy: string }> | undefined });
      }
    }

    async function connect() {
      if (cancelledRef.current) return;

      let token: string;
      let sseUrl: string | undefined;
      try {
        let turnstileToken: string | null = null;
        if (turnstileTokenProviderRef.current) {
          // El widget del invitado emite el token ~1-2s después de montar.
          // Esperar hasta 5s (mismo patrón que waitForTurnstile, inline para
          // no depender del módulo mockeado en tests).
          for (let i = 0; i < 25; i++) {
            turnstileToken = turnstileTokenProviderRef.current();
            if (turnstileToken) break;
            await new Promise((r) => setTimeout(r, 200));
          }
          if (!turnstileToken) {
            // Sin token el backend (verifyTurnstile estricto) responde 400 y
            // quema los reintentos: no postear, el polling de la página es el
            // fallback. Reintentar más tarde por si el widget aún no cargó.
            sseConnectedRef.current = false;
            onDisconnectedRef.current?.();
            if (retryCount < maxRetries) {
              retryCount++;
              reconnectTimeout = setTimeout(connect, 3000);
            }
            return;
          }
        }

        if (turnstileToken) {
          const data = await apiClient.post<{ token: string; url?: string }>(sseTokenEndpoint, { turnstileToken });
          token = data.token;
          sseUrl = data.url;
        } else {
          const data = await apiClient.post<{ token: string; url?: string }>(sseTokenEndpoint);
          token = data.token;
          sseUrl = data.url;
        }
      } catch (err) {
        reportError(err, { source: 'useSSE-connect' });
        if (cancelledRef.current) return;

        // El token pudo ser consumido por un claim previo (single-use): pedir
        // uno fresco para el próximo reintento.
        onTurnstileTokenRefreshedRef.current?.();

        if (err instanceof Error) {
          if (err.message.includes('Sesión expirada') || err.message.includes('No autorizado')) {
            onDisconnectedRef.current?.();
            return;
          }
          if (err.message.includes('Demasiadas solicitudes') || err.message.includes('demasiadas solicitudes')) {
            retryDelay = Math.min(retryDelay * 4, 60000);
          }
        }

        if (retryCount < maxRetries) {
          retryCount++;
          reconnectTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
        return;
      }

      if (cancelledRef.current) return;

      // Token consumido por el POST (single-use): emitir uno fresco para los
      // claims de la página.
      onTurnstileTokenRefreshedRef.current?.();

      try {
        const tokenParam = `token=${encodeURIComponent(token)}`;
        if (sseUrl) {
          // Defensa en profundidad: solo aceptar protocolo https (o http en dev local)
          const parsed = new URL(sseUrl);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('URL SSE inválida');
          es = new EventSource(`${sseUrl}?${tokenParam}`);
        } else {
          const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
          es = new EventSource(`${baseUrl}/api/events/${eventId}/gifts/subscribe?${tokenParam}`);
        }
      } catch (err) {
        reportError(err, { source: 'useSSE-EventSource' });
        sseConnectedRef.current = false;
        onDisconnectedRef.current?.();
        if (!cancelledRef.current && retryCount < maxRetries) {
          retryCount++;
          reconnectTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
        return;
      }

      es.onopen = () => {
        if (cancelledRef.current) { es?.close(); return; }
        retryDelay = initialRetryDelay;
        retryCount = 0;
        sseConnectedRef.current = true;
        onConnectedRef.current?.();
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'reconnect') {
            es?.close();
            es = null;
            sseConnectedRef.current = false;
            onDisconnectedRef.current?.();
            if (!cancelledRef.current) {
              retryCount = 0;
              retryDelay = initialRetryDelay;
              reconnectTimeout = setTimeout(connect, 100);
            }
            return;
          }
          handleMessage(data);
        } catch (err) { reportError(err, { source: 'useSSE-parse' }); }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        sseConnectedRef.current = false;
        onDisconnectedRef.current?.();

        if (!cancelledRef.current && retryCount < maxRetries) {
          retryCount++;
          reconnectTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      };
    }

    connect();

    return () => {
      cancelledRef.current = true;
      sseConnectedRef.current = false;
      onDisconnectedRef.current?.();
      es?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [eventId, sseTokenEndpoint, initialRetryDelay, maxRetries]);

  return sseConnectedRef;
}

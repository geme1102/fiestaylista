import { useEffect, useRef } from 'react';
import { apiClient } from '../services/api';

interface SSEOptions {
  eventId: string;
  sseTokenEndpoint: string;
  onGiftClaimed?: (data: { giftId: string; giftName: string; claimedBy: string }) => void;
  onMessagePosted?: (data: { authorName: string; messagePreview: string }) => void;
  onPhotoUploaded?: (data: { photoUrl: string; uploadedBy: string }) => void;
  onCashContribution?: (data: { contributorName: string; amount: number; contributionType: 'created' | 'cancelled' }) => void;
  maxRetries?: number;
  initialRetryDelay?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useSSE({
  eventId, sseTokenEndpoint, onGiftClaimed, onMessagePosted, onPhotoUploaded, onCashContribution,
  maxRetries = 10, initialRetryDelay = 1000, onConnected, onDisconnected,
}: SSEOptions) {
  const cancelledRef = useRef(false);
  const sseConnectedRef = useRef(false);
  const onGiftClaimedRef = useRef(onGiftClaimed);
  const onMessagePostedRef = useRef(onMessagePosted);
  const onPhotoUploadedRef = useRef(onPhotoUploaded);
  const onCashContributionRef = useRef(onCashContribution);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  onGiftClaimedRef.current = onGiftClaimed;
  onMessagePostedRef.current = onMessagePosted;
  onPhotoUploadedRef.current = onPhotoUploaded;
  onCashContributionRef.current = onCashContribution;
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;

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
        onGiftClaimedRef.current?.({ giftId: data.giftId as string, giftName: data.giftName as string, claimedBy: data.claimedBy as string });
      } else if (data.type === 'cash:contribution') {
        onCashContributionRef.current?.({ contributorName: data.contributorName as string, amount: data.amount as number, contributionType: data.contributionType as 'created' | 'cancelled' });
      } else if (data.type === 'message:posted') {
        onMessagePostedRef.current?.({ authorName: data.authorName as string, messagePreview: data.messagePreview as string });
      } else if (data.type === 'photo:uploaded') {
        onPhotoUploadedRef.current?.({ photoUrl: data.photoUrl as string, uploadedBy: data.uploadedBy as string });
      } else if (data.giftId && data.claimedBy) {
        onGiftClaimedRef.current?.({ giftId: data.giftId as string, giftName: data.giftName as string, claimedBy: data.claimedBy as string });
      }
    }

    async function connect() {
      if (cancelledRef.current) return;

      let token: string;
      let sseUrl: string | undefined;
      try {
        const data = await apiClient.post<{ token: string; url?: string }>(sseTokenEndpoint);
        token = data.token;
        sseUrl = data.url;
      } catch (err) {
        if (cancelledRef.current) return;

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

      try {
        if (sseUrl) {
          es = new EventSource(`${sseUrl}?token=${encodeURIComponent(token)}`);
        } else {
          const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
          es = new EventSource(`${baseUrl}/api/events/${eventId}/gifts/subscribe?token=${encodeURIComponent(token)}`);
        }
      } catch {
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
        } catch { /* ignore parse errors */ }
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

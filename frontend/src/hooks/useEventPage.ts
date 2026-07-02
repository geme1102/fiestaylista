import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import { getEventBySlug } from '../services/events';
import { showToast } from './useToast';
import { reportError } from '../lib/reportError';
import { useTurnstile, waitForTurnstile } from './useTurnstile';
import { getGiftCategory } from '../data/giftEmojis';
import { useSSE } from './useSSE';
import type { Gift, Photo, EventType } from '../types';

interface GuestEvent {
  id: string; title: string; eventType: EventType; slug: string; hostPhone?: string; status?: string; isActive: boolean; createdAt: string;
  eventDate?: string | null; eventLocation?: string | null; eventNote?: string | null;
}

export function useEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<GuestEvent | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState(() => {
    try { return localStorage.getItem(`guestName:${slug}`) ?? ''; } catch { return ''; }
  });
  const [shaking, setShaking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [easyReadMode, setEasyReadMode] = useState(() => {
    try { return localStorage.getItem('fy_easy_read') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('fy_easy_read', String(easyReadMode)); } catch {}
  }, [easyReadMode]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const loadEventRef = useRef<() => Promise<void>>(undefined);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sseConnectedRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cancelPollRef = useRef<(() => void) | null>(null);
  const { containerRef: turnstileRef, token: turnstileToken, reset: resetTurnstile } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  const slugRef = useRef(slug);
  slugRef.current = slug;

  useLayoutEffect(() => {
    if (guestName && slugRef.current) {
      try { localStorage.setItem(`guestName:${slugRef.current}`, guestName); } catch {}
    }
  }, [guestName]);

  const loadEvent = useCallback(async () => {
    try {
      const data = await getEventBySlug(slug!);
      if (!mountedRef.current) return;
      if (!data.event.isActive) {
        setError('Este evento no está disponible');
        setLoading(false);
        return;
      }
      setEvent(data.event);
      setGifts(data.gifts || []);
      setPhotos(data.photos || []);
    } catch (err) {
      reportError(err, { source: 'useEventPage' });
      if (!mountedRef.current) return;
      let msg = err instanceof Error ? err.message : 'Evento no encontrado';
      if (msg.includes('Sesión expirada') || msg.includes('No autorizado')) {
        msg = 'Evento no encontrado';
      }
      setError(msg);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    loadEventRef.current = loadEvent;
  }, [loadEvent]);

  useEffect(() => {
    mountedRef.current = true;
    if (!slug) return;
    loadEventRef.current?.();

    const POLL_FALLBACK = 30000;

    let initialPollTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      pollTimerRef.current = setInterval(() => {
        if (!sseConnectedRef.current) {
          loadEventRef.current?.();
        }
      }, POLL_FALLBACK);
    }, 5000);

    const cancelPoll = () => {
      if (initialPollTimer) {
        clearTimeout(initialPollTimer);
        initialPollTimer = undefined;
      }
      clearInterval(pollTimerRef.current);
    };
    cancelPollRef.current = cancelPoll;

    function onVisibilityChange() {
      if (document.hidden) {
        cancelPoll();
      } else if (!sseConnectedRef.current) {
        loadEventRef.current?.();
        clearTimeout(initialPollTimer);
        initialPollTimer = setTimeout(() => {
          pollTimerRef.current = setInterval(() => {
            if (!sseConnectedRef.current) { loadEventRef.current?.(); }
          }, POLL_FALLBACK);
        }, 5000);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      cancelPoll();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(confettiTimerRef.current);
    };
  }, [slug]);

  useSSE({
    eventId: event?.id ?? '',
    sseTokenEndpoint: event?.id ? `/api/events/${event.id}/gifts/public-sse-token` : '',
    maxRetries: 10,
    initialRetryDelay: 2000,
    onConnected: () => {
      sseConnectedRef.current = true;
      cancelPollRef.current?.();
    },
    onDisconnected: () => {
      sseConnectedRef.current = false;
    },
    onGiftClaimed: (data) => {
      setGifts((prev) => prev.map((g) =>
        g.id === data.giftId ? { ...g, isClaimed: true, claimedBy: data.claimedBy } : g,
      ));
    },
    onCashContribution: () => {
      loadEvent();
    },
    onMessagePosted: () => {
      loadEvent();
    },
    onPhotoUploaded: () => {
      loadEvent();
    },
  });

  const handleClaim = useCallback(async (giftId: string, giftName: string) => {
    if (!event || !guestName.trim()) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }

    let token = turnstileTokenRef.current;
    if (!token) {
      token = await waitForTurnstile(() => turnstileTokenRef.current);
    }

    setClaimingId(giftId);
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${event.id}/gifts/${giftId}/claim`, {
        claimedBy: guestName.trim(),
        turnstileToken: token ?? undefined,
      });
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
      setShowConfetti(true);
      setShowSuccessModal(true);
      resetTurnstile();
      clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setShowConfetti(false);
      }, 3000);
      showToast(`¡${giftName} apartado! 🎉`, 'success');
    } catch (err) {
      reportError(err, { source: 'useEventPage' });
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('ya ha sido reservado') || msg.toLowerCase().includes('already claimed')) {
        showToast('Este regalo ya fue apartado por otra persona', 'error');
      } else {
        showToast('Error al apartar el regalo. Intenta de nuevo.', 'error');
      }
    } finally {
      setClaimingId(null);
    }
  }, [event, guestName]);

  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      if (navigator.share && (/Mobi|Android/i.test(navigator.userAgent) || 'ontouchstart' in window)) {
        try {
          const file = new File([blob], url.split('/').pop() || 'photo.jpg', { type: blob.type });
          await navigator.share({ files: [file], title: 'Foto del evento' });
          return;
        } catch (err) { reportError(err, { source: 'useEventPage' }); }
      }

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = url.split('/').pop() || 'photo.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      reportError(err, { source: 'useEventPage' });
      window.open(url, '_blank');
    }
  }, []);

  const availableGifts = useMemo(() => gifts.filter((g) => !g.isClaimed), [gifts]);
  const claimedGifts = useMemo(() => gifts.filter((g) => g.isClaimed), [gifts]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const cats: { label: string; color: string }[] = [];
    availableGifts.forEach((g) => {
      const c = getGiftCategory(g.name);
      if (!seen.has(c.label)) {
        seen.add(c.label);
        cats.push(c);
      }
    });
    return cats;
  }, [availableGifts]);

  const filteredGifts = useMemo(() => {
    if (!categoryFilter) return availableGifts;
    return availableGifts.filter((g) => getGiftCategory(g.name).label === categoryFilter);
  }, [availableGifts, categoryFilter]);

  const eventDateFormatted = event?.eventDate
    ? new Date(event.eventDate).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const eventTimeFormatted = event?.eventDate
    ? new Date(event.eventDate).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })
    : '';

  return {
    event, gifts, photos, loading, error,
    claimingId, guestName, setGuestName, shaking,
    showConfetti, showSuccessModal, setShowSuccessModal,
    easyReadMode, setEasyReadMode,
    categoryFilter, setCategoryFilter,
    inputRef, filterBarRef,
    turnstileRef,
    availableGifts, claimedGifts, categories, filteredGifts,
    eventDateFormatted, eventTimeFormatted,
    handleClaim, handleDownload,
    reloadEvent: loadEvent,
  };
}

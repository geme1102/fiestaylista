import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import { getEventBySlug } from '../services/events';
import { showToast } from './useToast';
import { reportError } from '../lib/reportError';
import { useTurnstile, waitForTurnstile } from './useTurnstile';
import { getGiftCategory } from '../data/giftEmojis';
import { useSSE } from './useSSE';
import type { Gift, Photo, Event } from '../types';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function useEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const toParam = searchParams.get('to');
  const [event, setEvent] = useState<Event | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  // B10: paginación incremental — getEventBySlug trae max 50 regalos / 15 fotos
  // sin "hasMore"; el botón aparece cuando la lista llegó al tope y la respuesta
  // del listado paginado (que sí devuelve hasMore) refina el estado.
  const [giftsHasMore, setGiftsHasMore] = useState(false);
  const [photosHasMore, setPhotosHasMore] = useState(false);
  const [loadingMoreGifts, setLoadingMoreGifts] = useState(false);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  // D2-A5: SSE incremental — un mensaje/aporte ya no recarga TODO el payload
  // (evento + 50 regalos + 15 fotos) en todos los clientes; cada sección
  // re-fetchea SOLO su endpoint vía estos keys.
  const [messagesRefreshKey, setMessagesRefreshKey] = useState(0);
  const [cashRefreshKey, setCashRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState(() => {
    const fromUrl = toParam ? safeDecode(toParam).replace(/_/g, ' ') : '';
    if (fromUrl) return fromUrl;
    try { return sessionStorage.getItem(`guestName:${slug}`) ?? ''; } catch { return ''; }
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
  const abortRef = useRef<AbortController | null>(null);
  const loadEventRef = useRef<() => Promise<void>>(undefined);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sseConnectedRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cancelPollRef = useRef<(() => void) | null>(null);
  const startPollingRef = useRef<(() => void) | null>(null);
  const rollbackRef = useRef<Gift[]>([]);
  const { containerRef: turnstileRef, token: turnstileToken, reset: resetTurnstile } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  const slugRef = useRef(slug);
  slugRef.current = slug;

  useLayoutEffect(() => {
    if (guestName && slugRef.current) {
      try { sessionStorage.setItem(`guestName:${slugRef.current}`, guestName); } catch {}
    }
  }, [guestName]);

  const loadEvent = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getEventBySlug(slug!, controller.signal);
      if (!mountedRef.current) return;
      if (!data.event.isActive) {
        setError('Este evento no está disponible');
        setLoading(false);
        return;
      }
      setEvent(data.event);
      setGifts(data.gifts || []);
      setPhotos(data.photos || []);
      setGiftsHasMore((data.gifts || []).length >= 50);
      setPhotosHasMore((data.photos || []).length >= 15);
    } catch (err) {
      if (controller.signal.aborted) return;
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
    let initialPollTimer: ReturnType<typeof setTimeout> | undefined;

    const stopPolling = () => {
      if (initialPollTimer) {
        clearTimeout(initialPollTimer);
        initialPollTimer = undefined;
      }
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = undefined;
    };

    const startPolling = () => {
      if (document.hidden || initialPollTimer || pollTimerRef.current) return;
      initialPollTimer = setTimeout(() => {
        initialPollTimer = undefined;
        pollTimerRef.current = setInterval(() => {
          if (!sseConnectedRef.current) {
            loadEventRef.current?.();
          }
        }, POLL_FALLBACK);
      }, 5000);
    };

    cancelPollRef.current = stopPolling;
    startPollingRef.current = startPolling;
    startPolling();

    function onVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        loadEventRef.current?.();
        startPolling();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(confettiTimerRef.current);
      clearTimeout(safetyTimerRef.current);
      clearTimeout(shakeTimerRef.current);
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
      if (mountedRef.current) {
        startPollingRef.current?.();
      }
    },
    onGiftClaimed: (data) => {
      setGifts((prev) => prev.map((g) => {
        if (g.id !== data.giftId) return g;
        const updated: Gift = { ...g, isClaimed: true, claimedBy: data.claimedBy };
        if (data.claims) {
          updated.claims = data.claims.map((c) => ({ id: c.id, giftId: g.id, claimedBy: c.claimedBy, createdAt: '' }));
        }
        return updated;
      }));
    },
    onCashContribution: () => {
      // D2-A5: CashFundSection re-fetchea solo su endpoint (getCashFund +
      // contribuciones), no el payload completo del evento.
      setCashRefreshKey((k) => k + 1);
    },
    onMessagePosted: () => {
      // D2-A5: MessageWall re-fetchea solo /messages (antes loadEvent()
      // recargaba evento+regalos+fotos y ni siquiera actualizaba el muro).
      setMessagesRefreshKey((k) => k + 1);
    },
    onPhotoUploaded: (data) => {
      // D2-A5: inserción incremental — la foto llega con su URL del SSE, sin
      // recargar el payload completo.
      if (!data.photoUrl) return;
      setPhotos((prev) => {
        if (prev.some((p) => p.url === data.photoUrl)) return prev;
        return [{
          id: `sse-${Date.now()}`,
          eventId: event?.id ?? '',
          url: data.photoUrl,
          caption: '',
          createdAt: new Date().toISOString(),
        }, ...prev];
      });
    },
  });

  const claimInFlightRef = useRef(false);

  const handleClaim = useCallback(async (giftId: string, giftName: string) => {
    if (claimInFlightRef.current) return;
    if (!event || !guestName.trim()) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShaking(true);
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setShaking(false), 600);
      return;
    }

    claimInFlightRef.current = true;

    let token = turnstileTokenRef.current;
    try {
      if (!token) {
        token = await waitForTurnstile(() => turnstileTokenRef.current);
      }
    } catch (err) {
      claimInFlightRef.current = false;
      setClaimingId(null);
      showToast(err instanceof Error ? err.message : 'Error de validación', 'error');
      return;
    }

    // C: si el token no llegó (turnstile no respondió a tiempo), no enviar la
    // request: el backend la rechazaría con 400 y el mensaje genérico.
    if (!token) {
      claimInFlightRef.current = false;
      setClaimingId(null);
      showToast('La verificación de seguridad sigue pendiente. Intenta de nuevo en unos segundos.', 'error');
      return;
    }

    setClaimingId(giftId);
    safetyTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setClaimingId(null);
        showToast('El servicio está tardando más de lo esperado. Intenta de nuevo.', 'info');
      }
    }, 15000);

    // Optimistic update
    setGifts((prev) => {
      rollbackRef.current = prev;
      return prev.map((g) =>
        g.id === giftId
          ? { ...g, isClaimed: true, claimedBy: guestName.trim() }
          : g
      );
    });

    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${event.id}/gifts/${giftId}/claim`, {
        claimedBy: guestName.trim(),
        turnstileToken: token ?? undefined,
      });
      clearTimeout(safetyTimerRef.current);
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
      clearTimeout(safetyTimerRef.current);
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('ya ha sido reservado') || msg.toLowerCase().includes('already claimed')) {
        // El regalo lo apartó otra persona (o el mismo desde otro tab):
        // recargar el estado real del servidor en vez de hacer rollback a ciegas
        // (evita el "ghost unclaim" que deja el regalo visualmente libre).
        loadEvent();
        showToast('Este regalo ya fue apartado por otra persona', 'error');
      } else {
        // Rollback optimistic update
        if (rollbackRef.current.length > 0) {
          setGifts(rollbackRef.current);
          rollbackRef.current = [];
        }
        reportError(err, { source: 'useEventPage' });
        showToast('Error al apartar el regalo. Intenta de nuevo.', 'error');
      }
    } finally {
      claimInFlightRef.current = false;
      setClaimingId(null);
    }
  }, [event, guestName, loadEvent]);

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
      try {
        const safe = new URL(url);
        if (safe.protocol === 'https:' || safe.protocol === 'http:') {
          window.open(url, '_blank', 'noopener');
        }
      } catch {
        /* invalid URL — ignore */
      }
    }
  }, []);

  const availableGifts = useMemo(() => gifts.filter((g) => !g.isClaimed), [gifts]);
  const claimedGifts = useMemo(() => gifts.filter((g) => g.isClaimed), [gifts]);

  // B10: cursor = createdAt del último regalo/foto cargado (el listado ordena
  // por createdAt DESC y el backend compara con `<`). Dedupe por id por si
  // hay timestamps idénticos entre páginas.
  const loadMoreGifts = useCallback(async () => {
    if (!event || gifts.length === 0 || loadingMoreGifts) return;
    setLoadingMoreGifts(true);
    try {
      const last = gifts[gifts.length - 1];
      const cursor = new Date(last.createdAt).toISOString();
      const res = await apiClient.get<{ gifts: Gift[]; hasMore: boolean }>(`/api/events/${event.id}/gifts`, {
        params: { limit: '50', cursor },
        skipAuthRedirect: true,
      });
      setGifts((prev) => {
        const ids = new Set(prev.map((g) => g.id));
        return [...prev, ...(res.gifts || []).filter((g) => !ids.has(g.id))];
      });
      setGiftsHasMore(res.hasMore);
    } catch (err) {
      reportError(err, { source: 'useEventPage' });
      showToast('Error al cargar más regalos', 'error');
    } finally {
      setLoadingMoreGifts(false);
    }
  }, [event, gifts, loadingMoreGifts]);

  const loadMorePhotos = useCallback(async () => {
    if (!event || photos.length === 0 || loadingMorePhotos) return;
    setLoadingMorePhotos(true);
    try {
      const last = photos[photos.length - 1];
      const cursor = new Date(last.createdAt).toISOString();
      const res = await apiClient.get<{ photos: Photo[]; hasMore: boolean }>(`/api/events/${event.id}/photos`, {
        params: { limit: '50', cursor },
        skipAuthRedirect: true,
      });
      setPhotos((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...(res.photos || []).filter((p) => !ids.has(p.id))];
      });
      setPhotosHasMore(res.hasMore);
    } catch (err) {
      reportError(err, { source: 'useEventPage' });
      showToast('Error al cargar más fotos', 'error');
    } finally {
      setLoadingMorePhotos(false);
    }
  }, [event, photos, loadingMorePhotos]);

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
    event, gifts, photos, loading, error, toParam,
    claimingId, guestName, setGuestName, shaking,
    showConfetti, showSuccessModal, setShowSuccessModal,
    easyReadMode, setEasyReadMode,
    categoryFilter, setCategoryFilter,
    inputRef, filterBarRef,
    turnstileRef,
    messagesRefreshKey, cashRefreshKey,
    availableGifts, claimedGifts, categories, filteredGifts,
    eventDateFormatted, eventTimeFormatted,
    handleClaim, handleDownload,
    giftsHasMore, photosHasMore, loadingMoreGifts, loadingMorePhotos,
    loadMoreGifts, loadMorePhotos,
    reloadEvent: loadEvent,
  };
}

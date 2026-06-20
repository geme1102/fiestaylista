import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import { getEventBySlug } from '../services/events';
import { showToast } from './useToast';
import { useTurnstile } from './useTurnstile';
import { getGiftCategory } from '../data/giftEmojis';
import { useSSE } from './useSSE';
import type { Gift, Photo, EventType } from '../types';

interface GuestEvent {
  id: string; title: string; eventType: EventType; slug: string; hostPhone?: string; isActive: boolean; createdAt: string;
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
  const [claimName, setClaimName] = useState('');
  const [shaking, setShaking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [easyReadMode, setEasyReadMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const loadEventRef = useRef<() => Promise<void>>(undefined);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sseConnectedRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cancelPollRef = useRef<(() => void) | null>(null);
  const { containerRef: turnstileRef, token: turnstileToken } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

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
    loadEvent();

    const POLL_FALLBACK = 30000;

    let initialPollTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      pollTimerRef.current = setInterval(() => {
        if (!sseConnectedRef.current) {
          loadEventRef.current?.();
        }
      }, POLL_FALLBACK);
    }, 5000);

    const cancelPoll = () => {
      if (initialPollTimer) {
        clearTimeout(initialPollTimer);
        initialPollTimer = null;
      }
      clearInterval(pollTimerRef.current);
    };
    cancelPollRef.current = cancelPoll;

    function onVisibilityChange() {
      if (document.hidden) {
        cancelPoll();
      } else if (!sseConnectedRef.current) {
        loadEventRef.current?.();
        const rePollTimer = setTimeout(() => {
          pollTimerRef.current = setInterval(() => {
            if (!sseConnectedRef.current) { loadEventRef.current?.(); }
          }, POLL_FALLBACK);
        }, 5000);
        initialPollTimer = rePollTimer;
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      cancelPoll();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(confettiTimerRef.current);
    };
  }, [slug, loadEvent]);

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
  });

  const handleClaim = useCallback(async (giftId: string, giftName: string) => {
    if (!event || !claimName.trim()) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }

    let token = turnstileTokenRef.current;
    if (!token) {
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (turnstileTokenRef.current) { token = turnstileTokenRef.current; break; }
      }
    }

    setClaimingId(giftId);
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${event.id}/gifts/${giftId}/claim`, {
        claimedBy: claimName.trim(),
        turnstileToken: token ?? undefined,
      });
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
      setShowConfetti(true);
      setShowSuccessModal(true);
      clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 3000);
      setClaimName('');
      showToast(`¡${giftName} apartado! 🎉`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('ya ha sido reservado')) {
        showToast('Este regalo ya fue apartado por otra persona', 'error');
      } else {
        showToast('Error al apartar el regalo. Intenta de nuevo.', 'error');
      }
    } finally {
      setClaimingId(null);
    }
  }, [event, claimName]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    if (!file.type.startsWith('image/')) {
      showToast('Solo se permiten imágenes', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('La foto no puede superar los 10MB', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await apiClient.post<{ url: string }>('/api/upload/guest', formData);
      const res = await apiClient.post<{ photo: Photo }>(`/api/events/${event.id}/photos/guest`, {
        url: uploadRes.url,
      });

      setPhotos((prev) => [res.photo, ...prev]);
      showToast('¡Foto subida con éxito! 📸', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir la foto. Verifica que sea una imagen válida e intenta de nuevo.';
      showToast(msg, 'error');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [event]);

  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      if (navigator.share && (/Mobi|Android/i.test(navigator.userAgent) || 'ontouchstart' in window)) {
        try {
          const file = new File([blob], url.split('/').pop() || 'photo.jpg', { type: blob.type });
          await navigator.share({ files: [file], title: 'Foto del evento' });
          return;
        } catch { /* user cancelled */ }
      }

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = url.split('/').pop() || 'photo.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
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
    claimingId, claimName, setClaimName, shaking,
    showConfetti, showSuccessModal, setShowSuccessModal,
    easyReadMode, setEasyReadMode,
    categoryFilter, setCategoryFilter,
    uploadingPhoto,
    inputRef, filterBarRef, fileInputRef,
    turnstileRef,
    availableGifts, claimedGifts, categories, filteredGifts,
    eventDateFormatted, eventTimeFormatted,
    handleClaim, handlePhotoUpload, handleDownload,
  };
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import { getEventBySlug } from '../services/events';
import { showToast } from './useToast';
import { getGiftCategory } from '../data/giftEmojis';
import type { Gift, Photo, EventType } from '../types';

interface GuestEvent {
  id: string; title: string; eventType: EventType; slug: string; hostPhone?: string; isActive: boolean; createdAt: string;
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
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const sseConnectedRef = useRef(false);

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

    const POLL_FAST = 30000;

    let pollTimer: ReturnType<typeof setInterval>;

    function schedulePoll(interval: number) {
      clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        if (!sseConnectedRef.current) {
          loadEventRef.current?.();
        }
      }, interval);
    }

    schedulePoll(POLL_FAST);

    function onVisibilityChange() {
      if (document.hidden) {
        clearInterval(pollTimer);
      } else if (!sseConnectedRef.current) {
        loadEventRef.current?.();
        schedulePoll(POLL_FAST);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(confettiTimerRef.current);
    };
  }, [slug, loadEvent]);

  useEffect(() => {
    if (!event?.id) return;

    let cancelled = false;
    let abortController: AbortController | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;

    async function connectSSE() {
      try {
        const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
        const tokenRes = await fetch(`${baseUrl}/api/events/${event!.id}/gifts/public-sse-token`, { method: 'POST' });
        if (!tokenRes.ok || cancelled) return;
        const { token } = await tokenRes.json();

        abortController = new AbortController();
        const response = await fetch(`${baseUrl}/api/events/${event!.id}/gifts/subscribe`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body || cancelled) return;

        retryDelay = 2000;
      sseConnectedRef.current = true;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
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
                  loadEventRef.current?.();
                }
              } catch { /* ignore parse errors */ }
            }
          }
        }
      } catch { /* SSE disconnected */ }

      if (!cancelled) {
        reconnectTimeout = setTimeout(connectSSE, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }

    connectSSE();

    return () => {
      cancelled = true;
      sseConnectedRef.current = false;
      if (abortController) abortController.abort();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [event?.id]);

  const handleClaim = useCallback(async (giftId: string, giftName: string) => {
    if (!event || !claimName.trim()) {
      showToast('Escribe tu nombre para que sepan quién apartó el regalo', 'error');
      inputRef.current?.focus();
      return;
    }
    setClaimingId(giftId);
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${event.id}/gifts/${giftId}/claim`, {
        claimedBy: claimName.trim(),
      });
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
      setShowConfetti(true);
      setShowSuccessModal(true);
      clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 3000);
      setClaimName('');
      showToast(`¡${giftName} apartado! 🎉`, 'success');
    } catch {
      showToast('Error al apartar el regalo', 'error');
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
      const msg = err instanceof Error ? err.message : 'Error al subir la foto';
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
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = url.split('/').pop() || 'photo.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      showToast('Error al descargar la foto', 'error');
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

  const createdDate = event?.createdAt
    ? new Date(event.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return {
    event, gifts, photos, loading, error,
    claimingId, claimName, setClaimName,
    showConfetti, showSuccessModal, setShowSuccessModal,
    easyReadMode, setEasyReadMode,
    categoryFilter, setCategoryFilter,
    uploadingPhoto,
    inputRef, filterBarRef, fileInputRef,
    availableGifts, claimedGifts, categories, filteredGifts, createdDate,
    handleClaim, handlePhotoUpload, handleDownload,
  };
}

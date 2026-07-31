const Z_LAYERS = {
  dropdown: 50,
  sticky: 60,
  modal: 70,
  tooltip: 80,
  tour: 100,
} as const;

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Pencil, Eye,
  Calendar, MapPin, Info,
  ChevronRight, Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { apiClient } from '../services/api';
import { getCashFund } from '../services/cashFund';
import { reportError } from '../lib/reportError';
import { showToast } from '../hooks/useToast';
import { useSSE } from '../hooks/useSSE';
import { uploadPhoto, addPhoto } from '../services/events';
import { completeOnboarding } from '../services/onboarding';
import { EVENT_ICONS, TIER_LIMITS, type EventType, type Gift, type Photo } from '../types';
import { GIFT_SUGGESTIONS } from '../data/giftSuggestions';

import { ConfirmModal } from '../components/ConfirmModal';
import ShareButtons from '../components/ShareButtons';
import { EventReadyBar, type SetupChecklist } from '../components/EventReadyBar';
import { ProductTour, type TourStep } from '../components/ui/ProductTour';
import { Skeleton } from '../components/ui/Skeleton';
import { useAchievements } from '../hooks/useAchievements';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import EventAdminLoadingSkeleton from '../components/admin/EventAdminLoadingSkeleton';
import EditEventModal from '../components/admin/EditEventModal';
import { AnimatePresence } from 'framer-motion';

const GiftManagement = lazy(() => import('../components/admin/GiftManagement'));
const PhotoGallery = lazy(() => import('../components/admin/PhotoGallery').then(m => ({ default: m.PhotoGallery })));
const GuestsPanel = lazy(() => import('../components/admin/GuestsPanel'));
const MessagesPanel = lazy(() => import('../components/admin/MessagesPanel'));
const CashFundSection = lazy(() => import('../components/CashFundSection'));

interface AdminEvent {
  id: string; title: string; eventType: EventType; slug: string; status?: 'active' | 'completed' | 'paused'; isActive: boolean;
  eventDate?: string | null; eventLocation?: string | null; eventNote?: string | null;
  viewCount?: number;
  frozenAt?: string | null;
}

export default function EventAdmin() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [newGiftName, setNewGiftName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState<EventType>('BABY_SHOWER');
  const [dateDraft, setDateDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);

  const [cashFund, setCashFund] = useState<{ collectedAmount?: number; isActive?: boolean } | null>(null);

  const [deletePhotoConfirm, setDeletePhotoConfirm] = useState<string | null>(null);
  const [addingGift, setAddingGift] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deletingGiftId, setDeletingGiftId] = useState<string | null>(null);
  const [freeingGiftId, setFreeingGiftId] = useState<string | null>(null);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [selectedPhotoForPreview, setSelectedPhotoForPreview] = useState<Photo | null>(null);
  const [messageRefreshKey, setMessageRefreshKey] = useState(0);
  const { evaluate: evaluateAchievements } = useAchievements();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const addGiftSubmittingRef = useRef(false);
  const addSuggestionSubmittingRef = useRef(false);
  const updateDetailsSubmittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const isFrozen = !!event?.frozenAt;

  const setupChecklist: SetupChecklist = useMemo(() => ({
    hasGifts: gifts.length > 0,
    hasThreeGifts: gifts.length >= 3,
    hasDate: !!event?.eventDate,
    hasLocation: !!event?.eventLocation,
    hasNote: !!event?.eventNote,
    hasPhotos: photos.length > 0,
    hasCashFund: !!cashFund?.isActive,
    hasRsvp: gifts.some((g) => g.isClaimed),
    hasBeenShared: id ? (() => { try { return localStorage.getItem(`fy_shared_${id}`) === 'true'; } catch { return false; } })() : false,
  }), [gifts, photos, event, cashFund, id]);

  const setupPercent = useMemo(() => {
    const weights = { hasGifts: 15, hasThreeGifts: 10, hasDate: 15, hasLocation: 10, hasNote: 10, hasPhotos: 10, hasCashFund: 10, hasRsvp: 10, hasBeenShared: 10 };
    return Math.min(Object.entries(setupChecklist).reduce((sum, [k, v]) => sum + (v ? weights[k as keyof typeof weights] : 0), 0), 100);
  }, [setupChecklist]);

  useEffect(() => {
    evaluateAchievements({
      eventCount: 1,
      totalGifts: gifts.length,
      maxGiftsInEvent: gifts.length,
      cashFundActive: !!cashFund?.isActive,
      totalMessages: 0,
      photoCount: photos.length,
      maxPhotos: TIER_LIMITS[user?.tier ?? 'free'].maxPhotosPerEvent,
      eventViews: event?.viewCount ?? 0,
      isPro: user?.tier !== 'free',
      setupComplete: setupPercent >= 100,
    });
  }, [setupPercent, gifts.length, photos.length, cashFund, user?.tier, evaluateAchievements, event?.viewCount]);

  const tourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="edit"]', title: 'Personaliza tu evento', body: 'Toca el lápiz para cambiar el nombre, la fecha, el lugar y el mensaje de bienvenida de tus invitados.', cta: 'Entendido', placement: 'bottom' },
    { target: '[data-tour="preview"]', title: 'Comparte tu enlace', body: 'Envía tu lista por WhatsApp o copia el enlace. Tus invitados NO necesitan registrarse — ven la lista y apartan al instante.', cta: 'Genial', placement: 'bottom' },
    { target: '[data-tour="guests"]', title: 'Tus invitados', body: 'Aquí verás quién confirmó asistencia y qué regalos apartaron, en tiempo real.', cta: '¡Listo!', placement: 'bottom' },
  ], []);

  const handleTourComplete = useCallback(() => {
    completeOnboarding().then(() => refreshUser()).catch((err) => {
      reportError(err, { source: 'EventAdmin' });
    });
  }, [refreshUser]);

  const loadEvent = useCallback(async () => {
    try {
      if (!id) return;
      const [eventRes, fundRes] = await Promise.all([
        apiClient.get<{ event: AdminEvent & { gifts?: Gift[]; photos?: Photo[] } }>(`/api/events/${id}`),
        getCashFund(id),
      ]);
      const ev = eventRes.event;
      setEvent(ev);
      setTitleDraft(ev.title);
      setTypeDraft(ev.eventType);
      setDateDraft(ev.eventDate ? ev.eventDate.slice(0, 16) : '');
      setLocationDraft(ev.eventLocation ?? '');
      setNoteDraft(ev.eventNote ?? '');
      setGifts(ev.gifts || []);
      setPhotos(ev.photos || []);
      if (fundRes.cashFund) setCashFund(fundRes.cashFund);
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id, loadEvent]);

  useSSE({
    eventId: id ?? '',
    sseTokenEndpoint: id ? `/api/events/${id}/gifts/sse-token` : '',
    maxRetries: 50,
    initialRetryDelay: 1000,
    onGiftClaimed: (data) => {
      showToast(`🎉 ${data.claimedBy} apartó: ${data.giftName}`, 'success');
      setGifts((prev) => prev.map((g) =>
        g.id === data.giftId ? { ...g, isClaimed: true, claimedBy: data.claimedBy } : g,
      ));
    },
    onMessagePosted: () => {
      setMessageRefreshKey((k) => k + 1);
    },
    onPhotoUploaded: () => {
      if (id) {
        apiClient.get<{ event: { photos?: Photo[] } }>(`/api/events/${id}`).then((res) => {
          if (mountedRef.current) setPhotos(res.event.photos || []);
        }).catch((err) => { reportError(err, { source: 'EventAdmin' }); });
      }
    },
  });

  const handleAddGift = useCallback(async () => {
    if (addGiftSubmittingRef.current) return;
    addGiftSubmittingRef.current = true;
    if (!newGiftName.trim() || addingGift) return;
    setAddingGift(true);
    try {
      const res = await apiClient.post<{ gift: Gift }>(`/api/events/${id}/gifts`, { name: newGiftName.trim() });
      setGifts((prev) => [...prev, res.gift]);
      setNewGiftName('');
      setShowSuggestions(false);
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast(err instanceof Error ? err.message : 'Error al agregar regalo', 'error');
    } finally {
      addGiftSubmittingRef.current = false;
      setAddingGift(false);
    }
  }, [newGiftName, addingGift, id]);

  const handleDeleteGift = useCallback(async (giftId: string) => {
    setDeletingGiftId(giftId);
    try {
      await apiClient.del(`/api/events/${id}/gifts/${giftId}`);
      setGifts((prev) => prev.filter((g) => g.id !== giftId));
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast('Error al eliminar el regalo. Intenta de nuevo.', 'error');
    } finally {
      setDeletingGiftId(null);
    }
  }, [id]);

  const handleFreeGift = useCallback(async (giftId: string) => {
    setFreeingGiftId(giftId);
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${id}/gifts/${giftId}/free`);
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast('Error al liberar el regalo. Intenta de nuevo.', 'error');
    } finally {
      setFreeingGiftId(null);
    }
  }, [id]);

  const handleAddSuggestion = useCallback(async (name: string) => {
    if (addSuggestionSubmittingRef.current) return;
    addSuggestionSubmittingRef.current = true;
    setAddingGift(true);
    try {
      const res = await apiClient.post<{ gift: Gift }>(`/api/events/${id}/gifts`, { name });
      setGifts((prev) => [...prev, res.gift]);
      showToast(`Regalo sugerido "${name}" añadido 🎁`, 'success');
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast('Error al agregar regalo', 'error');
    } finally {
      addSuggestionSubmittingRef.current = false;
      setAddingGift(false);
    }
  }, [id]);

  const handleUpdateDetails = async () => {
    if (updateDetailsSubmittingRef.current) return;
    updateDetailsSubmittingRef.current = true;
    if (!titleDraft.trim()) {
      showToast('El nombre del evento es obligatorio', 'error');
      return;
    }
    setUpdatingDetails(true);
    try {
      const res = await apiClient.put<{ event: AdminEvent }>(`/api/events/${id}`, {
        title: titleDraft.trim(),
        eventType: typeDraft,
        eventDate: dateDraft ? new Date(dateDraft).toISOString() : null,
        eventLocation: locationDraft || null,
        eventNote: noteDraft || null,
      });
      setEvent((prev) => prev ? { ...prev, ...res.event } : prev);
      setEditingDetails(false);
      showToast('¡Información y detalles actualizados con éxito! 💾', 'success');
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast('Error al actualizar los datos del evento. Verifica los campos e intenta de nuevo.', 'error');
    } finally {
      updateDetailsSubmittingRef.current = false;
      setUpdatingDetails(false);
    }
  };

  const handleUploadPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter((f) => {
      if (!f.type.startsWith('image/')) {
        showToast(`"${f.name}" no es una imagen`, 'error');
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        showToast(`"${f.name}" supera los 10MB`, 'error');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadPercent(0);
    setUploadProgress(`Subiendo 0 de ${validFiles.length}...`);

    let completed = 0;
    const fileProgress = new Map<number, number>();
    const fileWeights = validFiles.map((f) => f.size);
    const totalWeight = fileWeights.reduce((a, b) => a + b, 0) || 1;

    await Promise.allSettled(
      validFiles.map((file, idx) =>
        (async () => {
          try {
            const { url } = await uploadPhoto(file, (pct) => {
              fileProgress.set(idx, pct * fileWeights[idx] / 100);
              const total = [...fileProgress.values()].reduce((a, b) => a + b, 0);
              setUploadPercent(Math.round((total / totalWeight) * 100));
            });
            const res = await addPhoto(id!, url);
            completed++;
            setUploadProgress(`Subiendo ${completed} de ${validFiles.length}...`);
            setPhotos((prev) => [...prev, res.photo]);
          } catch (err) {
            reportError(err, { source: 'EventAdmin' });
            const msg = err instanceof Error ? err.message : `Error al subir "${file.name}"`;
            showToast(msg, 'error');
          }
        })()
      ),
    );

    setUploadProgress(null);
    setUploadPercent(0);
    setUploading(false);
    e.target.value = '';
  }, [id]);

  const handleToggleFeatured = useCallback(async (photoId: string) => {
    try {
      const res = await apiClient.put<{ photo: Photo }>(`/api/events/${id}/photos/${photoId}/feature`);
      setPhotos((prev) => prev.map((p) => p.id === photoId ? { ...p, isFeatured: res.photo.isFeatured } : p));
      showToast(res.photo.isFeatured ? 'Foto destacada ⭐' : 'Foto no destacada', 'success');
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast(err instanceof Error ? err.message : 'Error al destacar foto', 'error');
    }
  }, [id]);

  const handleDeletePhoto = useCallback(async (photoId: string) => {
    setDeletePhotoConfirm(null);
    setDeletingPhoto(true);
    try {
      await apiClient.del(`/api/events/${id}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      showToast('Foto eliminada', 'success');
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast('Error al eliminar la foto. Intenta de nuevo.', 'error');
    } finally {
      setDeletingPhoto(false);
    }
  }, [id]);

  const handleComplete = useCallback(async () => {
    if (!id || !event || completing) return;
    setCompleting(true);
    try {
      await apiClient.post(`/api/events/${id}/complete`);
      setEvent((prev) => prev ? { ...prev, status: 'completed' } : null);
      showToast('Evento finalizado 🎉', 'success');
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast(err instanceof Error ? err.message : 'Error al finalizar evento', 'error');
    } finally {
      setCompleting(false);
    }
  }, [id, event, completing]);

  const handleReactivate = useCallback(async () => {
    if (!id || !event || completing) return;
    setCompleting(true);
    try {
      const res = await apiClient.post<{ event: AdminEvent }>(`/api/events/${id}/reactivate`);
      setEvent(res.event);
      showToast('Evento reactivado', 'success');
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      showToast(err instanceof Error ? err.message : 'Error al reactivar evento', 'error');
    } finally {
      setCompleting(false);
    }
  }, [id, event, completing]);

  const [toggling, setToggling] = useState(false);

  const [toggleConfirm, setToggleConfirm] = useState(false);

  const suggestions = useMemo(() => {
    if (!event) return [];
    return GIFT_SUGGESTIONS[event.eventType] || [];
  }, [event]);
  const debouncedQuery = useDebounce(newGiftName, 200);
  const filteredSuggestions = useMemo(() => {
    if (!debouncedQuery) return suggestions;
    const q = debouncedQuery.toLowerCase();
    return suggestions.filter((s) =>
      s.toLowerCase().includes(q) &&
      !gifts.some((g) => g.name.toLowerCase() === s.toLowerCase())
    );
  }, [suggestions, debouncedQuery, gifts]);

  const formatDateTime = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const date = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  }, []);

  const toggleActive = async () => {
    if (toggling) return;
    const prevActive = event?.isActive;
    setToggling(true);
    setEvent((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev);
    try {
      await apiClient.put(`/api/events/${id}`, { isActive: !prevActive });
      showToast(prevActive ? 'El evento ha sido pausado de forma privada' : '¡Tu evento ya está disponible en vivo! ⚡', 'success');
    } catch (err) {
      reportError(err, { source: 'EventAdmin' });
      setEvent((prev) => prev ? { ...prev, isActive: prevActive! } : prev);
      showToast('Error al cambiar el estado del evento. Intenta de nuevo.', 'error');
    } finally {
      setToggling(false);
      setToggleConfirm(false);
    }
  };

  if (loading) {
    return <EventAdminLoadingSkeleton />;
  }

  if (!event) {
    if (loadError) {
      return (
        <div className="text-center py-20 px-4">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center text-4xl">
            ⚠️
          </div>
          <p className="text-on-surface-variant font-semibold mb-2">Error al cargar el evento</p>
          <p className="text-sm text-on-surface-variant/60 mb-6 max-w-md mx-auto">Revisa tu conexión e intenta de nuevo.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => { setLoadError(false); setLoading(true); loadEvent(); }}
              className="px-6 py-3 min-h-[44px] bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold shadow-lg"
            >
              Reintentar
            </button>
            <Link to="/dashboard" className="px-6 py-3 min-h-[44px] border border-outline-variant text-on-surface rounded-full font-semibold inline-block hover:bg-surface-container-low">Volver al dashboard</Link>
          </div>
        </div>
      );
    }
    return (
      <div className="text-center py-20 px-4">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-fixed to-primary-fixed-dim flex items-center justify-center text-4xl">
          😕
        </div>
        <p className="text-on-surface-variant font-semibold mb-4">Evento no encontrado</p>
        <Link to="/dashboard" className="text-primary font-bold inline-block hover:underline">Volver al dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans antialiased pb-24 relative overflow-hidden selection:bg-primary/20 selection:text-primary">

      {/* Ambient glow backgrounds */}
      <div className="absolute top-[-180px] left-[-150px] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-pink-300/30 to-rose-400/20 blur-[130px] pointer-events-none -z-10 animate-pulse duration-[12000ms]" />
      <div className="absolute top-[350px] right-[-150px] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-amber-200/25 to-pink-300/20 blur-[110px] pointer-events-none -z-10" />
      <div className="absolute bottom-[0px] left-[-250px] w-[700px] h-[700px] rounded-full bg-primary/5 blur-[160px] pointer-events-none -z-10" />

      {/* Glossy Navigation Bar */}
      <nav className="sticky top-0 crystal-nav border-b border-white/20 px-4 py-4 md:px-8 pt-safe flex items-center justify-between" style={{ zIndex: Z_LAYERS.sticky }}>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate('/dashboard')}
            className="p-2.5 min-h-[44px] min-w-[44px] hover:bg-primary/5 border border-rose-100/30 hover:border-pink-300/30 rounded-2xl transition-colors cursor-pointer text-primary flex items-center justify-center bg-surface shadow-sm"
            aria-label="Regresar"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </motion.button>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-primary/60">PANEL DE CONTROL</span>
            <h1 className="text-lg md:text-xl font-extrabold text-primary tracking-tight flex items-center gap-2 truncate max-w-[200px] md:max-w-xs">
              {event?.title || 'Evento'}
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-primary-fixed border border-primary/10 px-3.5 py-1.5 rounded-full shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-on-surface-variant font-extrabold tracking-wider uppercase">MODO EDICIÓN ACTIVO</span>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 mt-8 relative z-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-6 font-semibold px-2">
          <Link to="/dashboard" className="hover:text-rose-950 hover:underline transition-colors duration-200">Mis Eventos</Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="bg-surface/70 border border-rose-100/35 px-3 py-1 rounded-full text-primary font-black shadow-sm flex items-center gap-1">
            <Home className="w-3 h-3 text-primary" />
            {event.title}
          </span>
        </div>

        {/* Main Event Card */}
          <section className="relative bg-surface/80 backdrop-blur-xl rounded-[32px] p-6 md:p-8 shadow-[0_25px_60px_-15px_rgba(162,27,83,0.06)] border border-white/70 mb-8 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r from-pink-300 via-rose-500 to-amber-300" />

          {/* Header row: avatar, title, toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-rose-100/20">
            <div className="flex items-center gap-[18px]">
              <motion.div
                whileHover={{ rotate: 8, scale: 1.05 }}
                className="relative w-[72px] h-[72px] bg-gradient-to-br from-[#fff2f5] to-[#ffe5eb] border border-white flex items-center justify-center rounded-2xl text-4xl shadow-[0_10px_25px_rgba(162,27,83,0.09)] shrink-0 cursor-default"
              >
                {EVENT_ICONS[event.eventType]}
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border border-white text-[7px] text-white font-bold items-center justify-center">★</span>
                </span>
              </motion.div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight flex items-center gap-1.5 truncate">
                      {event.title}
                    </h2>
                    <motion.button
                      type="button"
                      data-testid="edit-event-button"
                      data-tour="edit"
                      whileHover={{ scale: 1.15, rotate: 15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setEditingDetails(true);
                        setTitleDraft(event.title);
                        setTypeDraft(event.eventType);
                        setDateDraft(event.eventDate ? event.eventDate.slice(0, 16) : '');
                        setLocationDraft(event.eventLocation ?? '');
                        setNoteDraft(event.eventNote ?? '');
                      }}
                      className="min-w-[44px] min-h-[44px] p-2.5 text-primary hover:bg-primary/15 rounded-xl transition-[background-color,border-color] cursor-pointer bg-white border border-primary/15 shadow-sm flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                      title={`Editar evento ${event.title}`}
                      aria-label={`Editar evento ${event.title}`}
                    >
                      <Pencil className="w-[18px] h-[18px]" />
                    </motion.button>
                </div>

                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs font-bold text-primary bg-primary-fixed border border-primary/10 px-3 py-1 rounded-full">
                    {gifts.length} regalos
                  </span>
                  {photos.length > 0 && (
                    <span className="text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100/50 px-3 py-1 rounded-full">
                      {photos.length} fotos
                    </span>
                  )}
                </div>

              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between sm:justify-start gap-4 bg-surface border border-primary/10 p-3.5 rounded-2xl shadow-sm self-stretch sm:self-center">
              <div className="flex flex-col text-left">
                <span className="text-[9px] text-primary font-extrabold tracking-widest uppercase">ESTADO DE EVENTO</span>
                <span className={`text-xs font-semibold tracking-wide ${event.isActive ? 'text-emerald-700 font-extrabold' : 'text-on-surface-variant font-medium'}`}>
                  {event.isActive ? '● ACTIVO EN LÍNEA' : '○ PAUSADO'}
                </span>
              </div>

              <button
              data-testid="toggle-event-status"
              onClick={() => setToggleConfirm(true)}
              className={`touch-compact relative w-14 h-11 min-h-[44px] rounded-full p-1 transition-all duration-300 focus:outline-none cursor-pointer flex items-center ${event.isActive ? 'bg-primary' : 'bg-gray-200'}`}
              aria-label="Cambiar estado del evento"
              >
                {event.isActive && (
                  <span className="absolute inset-0 bg-primary rounded-full blur-[2px] opacity-30 animate-pulse" />
                )}
                <div className={`w-[22px] h-[22px] bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-transform duration-300 transform ${event.isActive ? 'translate-x-[26px]' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* El Después — Complete/Reactivate */}
            {event.status === 'completed' ? (
              <button
                onClick={handleReactivate}
                disabled={completing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-outline-variant/30 bg-surface hover:bg-surface-container-higher transition-all text-xs font-bold text-on-surface-variant hover:text-on-surface self-stretch sm:self-center min-h-[44px]"
              >
                <span className="material-symbols-outlined text-sm">undo</span>
                Reactivar evento
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all text-xs font-bold text-primary self-stretch sm:self-center min-h-[44px]"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Finalizar evento
              </button>
            )}
          </div>

          {isFrozen && (
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300/40 rounded-2xl p-5 mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none bg-amber-100 text-amber-700 w-11 h-11 flex items-center justify-center rounded-2xl shadow-sm shrink-0">⚠️</span>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-extrabold text-amber-900">Evento congelado</span>
                  <span className="text-xs text-amber-800/80 font-medium mt-0.5">
                    Tu suscripción Pro expiró. Los invitados no pueden ver este evento. Reactiva tu plan para desbloquearlo.
                  </span>
                </div>
              </div>
              <Link
                to="/pricing"
                className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-full shadow-md transition-all shrink-0 text-center"
              >
                Reactivar Plan Pro
              </Link>
            </div>
          )}

          {/* El Después Banner */}
          {event.status === 'completed' && (
            <div className="bg-gradient-to-r from-primary-fixed/20 via-surface-container-low to-primary-fixed/20 border border-primary/10 rounded-2xl p-5 mt-6 flex items-start gap-4 shadow-sm">
              <span className="text-2xl leading-none bg-primary-fixed/40 text-primary w-11 h-11 flex items-center justify-center rounded-2xl shadow-sm shrink-0">🎉</span>
              <div className="flex flex-col text-left">
                <span className="text-sm font-extrabold text-on-surface">Evento finalizado</span>
                <span className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Los invitados ya no pueden apartar regalos ni usar la Lluvia de Sobres. La galería y el muro de mensajes siguen activos.
                </span>
              </div>
            </div>
          )}

          {/* Cash Fund Section for Admin */}
          {id && (
            <div className="mt-6">
              <SectionErrorBoundary sectionName="CashFundSectionAdmin">
              <Suspense fallback={<Skeleton className="h-32 rounded-2xl" />}>
                <CashFundSection eventId={id} isOwner={true} />
              </Suspense>
              </SectionErrorBoundary>
            </div>
          )}

          {/* Share & Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] mt-6">
            <ShareButtons slug={event.slug} title={event.title} hostName={user?.name} eventType={event.eventType} eventDate={event.eventDate} eventLocation={event.eventLocation} />
            <motion.a
              href={`/e/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="group relative w-full bg-surface/45 hover:bg-surface/70 backdrop-blur-md border border-white shadow-[0_8px_30px_rgba(162,27,83,0.03),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:shadow-[0_12px_40px_rgba(162,27,83,0.08),inset_0_1px_1px_rgba(255,255,255,1)] text-primary py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer overflow-hidden"
              data-tour="preview"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
              <span>Vista Previa de Invitado</span>
              <Eye className="w-[18px] h-[18px] text-primary stroke-[2.2]" />
            </motion.a>
          </div>

          {/* Event Details Section */}
          <div className="mt-8 pt-6 border-t border-rose-100/20">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <h3 className="text-gray-900 font-extrabold text-sm tracking-widest uppercase">Detalles del Evento</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface border border-rose-100/30 rounded-2xl p-[18px] flex items-start gap-3.5 hover:bg-rose-50/20 transition-all shadow-sm">
                <div className="p-2.5 bg-primary/5 text-primary rounded-xl shrink-0">
                  <Calendar className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Fecha y Hora</span>
                  <span className="text-primary text-[13px] font-extrabold leading-snug mt-1.5">
                    {event.eventDate ? formatDateTime(event.eventDate) : 'Sin definir'}
                  </span>
                </div>
              </div>

              <div className="bg-surface border border-rose-100/30 rounded-2xl p-[18px] flex items-start gap-3.5 hover:bg-rose-50/20 transition-all shadow-sm">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl shrink-0">
                  <MapPin className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Ubicación / Lugar</span>
                  <span className="text-on-surface text-[13px] font-extrabold leading-snug mt-1.5">{event.eventLocation || 'Sin definir'}</span>
                </div>
              </div>

              <div className="bg-surface border border-rose-100/30 rounded-2xl p-[18px] flex items-start gap-3.5 hover:bg-rose-50/20 transition-all shadow-sm">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <Info className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Indicaciones</span>
                  <span className="text-gray-700 text-xs font-semibold leading-normal mt-1.5 line-clamp-3">{event.eventNote || 'Sin notas'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {setupPercent < 100 && (
          <div className="mb-8">
            <EventReadyBar
              checklist={setupChecklist}
              onAction={(hint) => showToast(`Pendiente: ${hint}`, 'info')}
            />
          </div>
        )}

        <ProductTour steps={tourSteps} storageKey="fy_tour_event_admin" completed={user?.onboardingCompleted} onComplete={handleTourComplete} />

        <div data-tour="add-gift">
        <SectionErrorBoundary sectionName="GiftManagement">
        <Suspense fallback={<Skeleton className="h-48 rounded-3xl" />}>
          <GiftManagement
            gifts={gifts}
            addingGift={addingGift}
            freeingGiftId={freeingGiftId}
            deletingGiftId={deletingGiftId}
            newGiftName={newGiftName}
            showSuggestions={showSuggestions}
            suggestions={suggestions}
            filteredSuggestions={filteredSuggestions}
            maxGiftsPerEvent={TIER_LIMITS[user?.tier ?? 'free'].maxGiftsPerEvent}
            onAddGift={handleAddGift}
            onFreeGift={handleFreeGift}
            onDeleteGift={handleDeleteGift}
            onAddSuggestion={handleAddSuggestion}
            onNewGiftNameChange={setNewGiftName}
            onShowSuggestionsChange={setShowSuggestions}
          />
        </Suspense>
        </SectionErrorBoundary>
        </div>

        <div data-tour="guests">
        <SectionErrorBoundary sectionName="GuestsPanel">
        <Suspense fallback={<Skeleton className="h-32 rounded-3xl" />}><GuestsPanel eventId={id ?? ''} /></Suspense>
        </SectionErrorBoundary>
        </div>

        <SectionErrorBoundary sectionName="MessagesPanel">
        <Suspense fallback={<Skeleton className="h-32 rounded-3xl" />}><MessagesPanel eventId={id ?? ''} refreshKey={messageRefreshKey} /></Suspense>
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="PhotoGallery">
        <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
          <PhotoGallery
            photos={photos}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadPercent={uploadPercent}
            deletingPhoto={deletingPhoto}
            deletePhotoConfirm={deletePhotoConfirm}
            fileInputRef={fileInputRef}
            maxPhotosPerEvent={TIER_LIMITS[user?.tier ?? 'free'].maxPhotosPerEvent}
            onUpload={handleUploadPhoto}
            onDelete={handleDeletePhoto}
            onRequestDelete={setDeletePhotoConfirm}
            onDeleteConfirmClose={() => setDeletePhotoConfirm(null)}
            onSelectPreview={setSelectedPhotoForPreview}
            selectedPhotoForPreview={selectedPhotoForPreview}
            onToggleFeatured={handleToggleFeatured}
          />
        </Suspense>
        </SectionErrorBoundary>
      </div>

      <AnimatePresence>
        {editingDetails && (
          <EditEventModal
            key="edit"
            open={editingDetails}
            titleDraft={titleDraft}
            typeDraft={typeDraft}
            dateDraft={dateDraft}
            locationDraft={locationDraft}
            noteDraft={noteDraft}
            updatingDetails={updatingDetails}
            onTitleChange={setTitleDraft}
            onTypeChange={setTypeDraft}
            onDateChange={setDateDraft}
            onLocationChange={setLocationDraft}
            onNoteChange={setNoteDraft}
            onSave={handleUpdateDetails}
            onClose={() => setEditingDetails(false)}
          />
        )}
      </AnimatePresence>

      {/* Toggle Confirm Modal */}
      <AnimatePresence>
        {toggleConfirm && (
          <ConfirmModal
            key="toggle"
            message={event.isActive
              ? '¿Pausar el evento? Los invitados verán la página como "no disponible" hasta que lo actives de nuevo.'
              : '¿Activar el evento? Los invitados podrán ver la lista, apartar regalos y enviar dinero.'}
            onConfirm={toggleActive}
            onClose={() => setToggleConfirm(false)}
            loading={toggling}
          />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      {/* Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 w-full flex justify-around items-center py-3 px-4 pb-safe crystal-nav border-t border-white/20 shadow-[0_-4px_20px_rgba(177,14,107,0.1)] rounded-t-xl" style={{ zIndex: Z_LAYERS.sticky }}>
        <Link to="/dashboard" className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-primary relative after:content-[''] after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full active:scale-90 duration-200">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
          <span className="font-label-md text-label-md">Eventos</span>
        </Link>
        <Link to="/pricing" className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-on-surface-variant hover:text-primary-container transition-all active:scale-90 duration-200 relative">
          <span className="material-symbols-outlined">card_giftcard</span>
          <span className="font-label-md text-label-md">Planes</span>
          <span className="absolute -top-0.5 -right-2 text-[7px] font-black px-1 py-0.5 rounded-full bg-primary/10 text-primary">
            {user?.tier === 'free' ? 'FREE' : user?.tier === 'pro_plus' ? 'PRO+' : 'PRO'}
          </span>
        </Link>
        <Link to="/account" className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-on-surface-variant hover:text-primary-container transition-all active:scale-90 duration-200">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md">Cuenta</span>
        </Link>
      </nav>
    </div>
  );
}

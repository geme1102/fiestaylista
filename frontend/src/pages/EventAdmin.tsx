import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Pencil, ChevronDown, Share2, Eye,
  MessageSquare, Copy, Calendar, MapPin, Info,
  X, Check,
  ChevronRight, Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { getCashFund, boostEvent } from '../services/cashFund';
import { showToast } from '../hooks/useToast';
import { useSSE } from '../hooks/useSSE';
import { uploadPhoto, addPhoto } from '../services/events';
import { EVENT_LABELS, EVENT_ICONS, type EventType, type Gift, type Photo } from '../types';
import { GIFT_SUGGESTIONS } from '../data/giftSuggestions';
import { validateRedirectUrl } from '../utils/format';
import { ConfirmModal } from '../components/ConfirmModal';
import { GiftManagement } from '../components/admin/GiftManagement';
import { PhotoGallery } from '../components/admin/PhotoGallery';

interface AdminEvent {
  id: string; title: string; eventType: EventType; slug: string; isActive: boolean; boostedUntil?: string;
  eventDate?: string | null; eventLocation?: string | null; eventNote?: string | null;
}

const EVENT_TYPES: { value: EventType; icon: string; label: string }[] = [
  { value: 'BABY_SHOWER', icon: '🍼', label: 'Baby Shower' },
  { value: 'WEDDING', icon: '💍', label: 'Boda' },
  { value: 'BIRTHDAY', icon: '🎂', label: 'Cumpleaños' },
  { value: 'BAPTISM', icon: '🕊️', label: 'Bautizo' },
  { value: 'COMMUNION', icon: '✨', label: 'Comunión' },
  { value: 'OTHER', icon: '🎊', label: 'Otro' },
  { value: 'HOUSE_WARMING', icon: '🏠', label: 'Casa Shower' },
];

export default function EventAdmin() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

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

  const [cashFund, setCashFund] = useState<{ collectedAmount?: number; isActive?: boolean } | null>(null);
  const [boostModal, setBoostModal] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);

  const [deletePhotoConfirm, setDeletePhotoConfirm] = useState<string | null>(null);
  const [addingGift, setAddingGift] = useState(false);
  const [deletingGiftId, setDeletingGiftId] = useState<string | null>(null);
  const [freeingGiftId, setFreeingGiftId] = useState<string | null>(null);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [selectedPhotoForPreview, setSelectedPhotoForPreview] = useState<Photo | null>(null);
  const [showCoach, setShowCoach] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvent = useCallback(async () => {
    try {
      const [eventRes, fundRes] = await Promise.all([
        apiClient.get<{ event: AdminEvent & { gifts?: Gift[]; photos?: Photo[] } }>(`/api/events/${id}`),
        getCashFund(id!),
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
    } catch {
      showToast('Error al cargar el evento. Recarga la página e intenta de nuevo.', 'error');
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
    maxRetries: 5,
    initialRetryDelay: 1000,
    onGiftClaimed: (data) => {
      showToast(`🎉 ${data.claimedBy} apartó: ${data.giftName}`, 'success');
      loadEvent();
    },
  });

  const handleAddGift = async () => {
    if (!newGiftName.trim() || addingGift) return;
    setAddingGift(true);
    try {
      const res = await apiClient.post<{ gift: Gift }>(`/api/events/${id}/gifts`, { name: newGiftName.trim() });
      setGifts((prev) => [...prev, res.gift]);
      setNewGiftName('');
      setShowSuggestions(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al agregar regalo', 'error');
    } finally {
      setAddingGift(false);
    }
  };

  const handleDeleteGift = async (giftId: string) => {
    setDeletingGiftId(giftId);
    try {
      await apiClient.del(`/api/events/${id}/gifts/${giftId}`);
      setGifts((prev) => prev.filter((g) => g.id !== giftId));
    } catch {
      showToast('Error al eliminar el regalo. Intenta de nuevo.', 'error');
    } finally {
      setDeletingGiftId(null);
    }
  };

  const handleFreeGift = async (giftId: string) => {
    setFreeingGiftId(giftId);
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${id}/gifts/${giftId}/free`);
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
    } catch {
      showToast('Error al liberar el regalo. Intenta de nuevo.', 'error');
    } finally {
      setFreeingGiftId(null);
    }
  };

  const handleAddSuggestion = async (name: string) => {
    setAddingGift(true);
    try {
      const res = await apiClient.post<{ gift: Gift }>(`/api/events/${id}/gifts`, { name });
      setGifts((prev) => [...prev, res.gift]);
      showToast(`Regalo sugerido "${name}" añadido 🎁`, 'success');
    } catch {
      showToast('Error al agregar regalo', 'error');
    } finally {
      setAddingGift(false);
    }
  };

  const handleUpdateDetails = async () => {
    setUpdatingDetails(true);
    try {
      const res = await apiClient.put<{ event: AdminEvent }>(`/api/events/${id}`, {
        title: titleDraft.trim(),
        eventType: typeDraft,
        eventDate: dateDraft ? new Date(dateDraft + ':00').toISOString() : null,
        eventLocation: locationDraft || null,
        eventNote: noteDraft || null,
      });
      setEvent((prev) => prev ? { ...prev, ...res.event } : prev);
      setEditingDetails(false);
      showToast('¡Información y detalles actualizados con éxito! 💾', 'success');
    } catch {
      showToast('Error al actualizar los datos del evento. Verifica los campos e intenta de nuevo.', 'error');
    } finally {
      setUpdatingDetails(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    let uploaded = 0;
    for (const file of validFiles) {
      uploaded++;
      setUploadProgress(`Subiendo foto ${uploaded} de ${validFiles.length}...`);
      try {
        const { url } = await uploadPhoto(file);
        const res = await addPhoto(id!, url);
        setPhotos((prev) => [...prev, res.photo]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Error al subir "${file.name}"`;
        showToast(msg, 'error');
      }
    }
    setUploadProgress(null);
    setUploading(false);
    e.target.value = '';
  };

  const handleDeletePhoto = async (photoId: string) => {
    setDeletePhotoConfirm(null);
    setDeletingPhoto(true);
    try {
      await apiClient.del(`/api/events/${id}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      showToast('Foto eliminada', 'success');
    } catch {
      showToast('Error al eliminar la foto. Intenta de nuevo.', 'error');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleBoost = async () => {
    if (!id) return;
    setBoostLoading(true);
    try {
      const res = await boostEvent(id!);
      if (res.url) {
        const validatedUrl = validateRedirectUrl(res.url);
        if (validatedUrl) {
          window.location.href = validatedUrl;
        } else {
          showToast('URL de pago inválida', 'error');
          setBoostLoading(false);
        }
      } else {
        showToast('¡Lluvia de sobres premium habilitada con éxito! ⚡💰', 'success');
        setBoostModal(false);
        setEvent((prev) => prev ? { ...prev, boostedUntil: res.boostedUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } : prev);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al activar Lluvia de Sobres. Intenta de nuevo.', 'error');
    } finally {
      setBoostLoading(false);
    }
  };

  const [toggling, setToggling] = useState(false);

  const [toggleConfirm, setToggleConfirm] = useState(false);

  const toggleActive = async () => {
    if (toggling) return;
    const prevActive = event?.isActive;
    setToggling(true);
    setEvent((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev);
    try {
      await apiClient.put(`/api/events/${id}`, { isActive: !prevActive });
      showToast(prevActive ? 'El evento ha sido pausado de forma privada' : '¡Tu evento ya está disponible en vivo! ⚡', 'success');
    } catch {
      setEvent((prev) => prev ? { ...prev, isActive: prevActive! } : prev);
      showToast('Error al cambiar el estado del evento. Intenta de nuevo.', 'error');
    } finally {
      setToggling(false);
      setToggleConfirm(false);
    }
  };

  const copyShareLink = () => {
    if (!event) return;
    const url = `${window.location.origin}/e/${event.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('¡Enlace exclusivo copiado al portapapeles! 🔗', 'success');
    }).catch(() => {
      showToast('Enlace copiado! 🔗', 'success');
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-10 px-4 max-w-4xl mx-auto mt-20">
        <div className="h-8 bg-rose-100/50 rounded-2xl w-1/3" />
        <div className="h-48 bg-rose-100/30 rounded-[32px]" />
        <div className="grid md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-rose-100/30 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 px-4">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-50 flex items-center justify-center text-4xl">
          😕
        </div>
        <p className="text-gray-500 font-semibold mb-4">Evento no encontrado</p>
        <Link to="/dashboard" className="text-[#a21b53] font-bold inline-block hover:underline">Volver al dashboard</Link>
      </div>
    );
  }

  const suggestions = GIFT_SUGGESTIONS[event.eventType] || [];
  const filteredSuggestions = suggestions.filter((s) =>
    s.toLowerCase().includes(newGiftName.toLowerCase()) &&
    !gifts.some((g) => g.name.toLowerCase() === s.toLowerCase())
  );
  const isBoosted = event.boostedUntil && new Date(event.boostedUntil) > new Date();

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  };

  return (
    <div className="min-h-screen bg-surface text-[#2c1f24] font-sans antialiased pb-24 relative overflow-hidden selection:bg-[#a21b53]/20 selection:text-[#a21b53]">

      {/* Ambient glow backgrounds */}
      <div className="absolute top-[-180px] left-[-150px] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-pink-300/30 to-rose-400/20 blur-[130px] pointer-events-none -z-10 animate-pulse duration-[12000ms]" />
      <div className="absolute top-[350px] right-[-150px] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-amber-200/25 to-pink-300/20 blur-[110px] pointer-events-none -z-10" />
      <div className="absolute bottom-[0px] left-[-250px] w-[700px] h-[700px] rounded-full bg-[#a21b53]/5 blur-[160px] pointer-events-none -z-10" />

      {/* Glossy Navigation Bar */}
      <nav className="sticky top-0 z-40 crystal-nav border-b border-white/20 px-4 py-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate('/dashboard')}
            className="p-2.5 hover:bg-[#a21b53]/5 border border-rose-100/30 hover:border-pink-300/30 rounded-2xl transition-all cursor-pointer text-[#a21b53] flex items-center justify-center bg-surface shadow-sm"
            aria-label="Regresar"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </motion.button>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-rose-400">PANEL DE CONTROL</span>
            <h1 className="text-lg md:text-xl font-extrabold text-[#7e143f] tracking-tight flex items-center gap-2 truncate max-w-[200px] md:max-w-xs">
              {event?.title || 'Evento'}
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-rose-50 border border-rose-100/40 px-3.5 py-1.5 rounded-full shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-gray-600 font-extrabold tracking-wider uppercase">MODO EDICIÓN ACTIVO</span>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 mt-8 relative z-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6 font-semibold px-2">
          <Link to="/dashboard" className="hover:text-rose-950 hover:underline transition-colors duration-200">Mis Eventos</Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="bg-surface/70 border border-rose-100/35 px-3 py-1 rounded-full text-[#a21b53] font-black shadow-sm flex items-center gap-1">
            <Home className="w-3 h-3 text-[#a21b53]" />
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
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#a21b53] border border-white text-[7px] text-white font-bold items-center justify-center">★</span>
                </span>
              </motion.div>

              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                    {event.title}
                  </h2>
                  <motion.button
                    data-testid="edit-event-button"
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
                    className="p-2.5 text-pink-500 hover:text-white hover:bg-[#a21b53] rounded-xl transition-all cursor-pointer bg-white border border-[#a21b53]/15 shadow-sm flex items-center justify-center"
                    title="Editar título del evento"
                  >
                    <Pencil className="w-[18px] h-[18px]" />
                  </motion.button>
                </div>

                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs font-bold text-pink-700 bg-pink-50 border border-pink-100/50 px-3 py-1 rounded-full">
                    {gifts.length} regalos
                  </span>
                  {photos.length > 0 && (
                    <span className="text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100/50 px-3 py-1 rounded-full">
                      {photos.length} fotos
                    </span>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setEditingDetails(true)}
                  className="text-gray-500 text-xs font-bold mt-2 py-1.5 px-3.5 bg-rose-50/50 hover:bg-rose-50 border border-rose-100/40 rounded-full inline-flex items-center gap-1.5 hover:text-gray-900 transition-all cursor-pointer group"
                >
                  <span className="w-2 h-2 rounded-full bg-[#a21b53]" />
                  <span>Tipo: <span className="text-[#a21b53] font-extrabold">{EVENT_LABELS[event.eventType]}</span></span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#a21b53] group-hover:translate-y-0.5 transition-transform" />
                </motion.button>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between sm:justify-start gap-4 bg-surface border border-[#a21b53]/10 p-3.5 rounded-2xl shadow-sm self-stretch sm:self-center">
              <div className="flex flex-col text-left">
                <span className="text-[9px] text-[#a21b53] font-extrabold tracking-widest uppercase">ESTADO DE EVENTO</span>
                <span className={`text-xs font-semibold tracking-wide ${event.isActive ? 'text-emerald-700 font-extrabold' : 'text-gray-400 font-medium'}`}>
                  {event.isActive ? '● ACTIVO EN LÍNEA' : '○ PAUSADO'}
                </span>
              </div>

              <button
              data-testid="toggle-event-status"
              onClick={() => setToggleConfirm(true)}
              className={`relative w-14 h-[30px] rounded-full p-1 transition-all duration-300 focus:outline-none cursor-pointer flex items-center ${event.isActive ? 'bg-[#c52367]' : 'bg-gray-200'}`}
              aria-label="Cambiar estado del evento"
              >
                {event.isActive && (
                  <span className="absolute inset-0 bg-[#c52367] rounded-full blur-[2px] opacity-30 animate-pulse" />
                )}
                <div className={`w-[22px] h-[22px] bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-transform duration-300 transform ${event.isActive ? 'translate-x-[26px]' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Lluvia de Sobres Banner */}
          {!isBoosted && user?.tier === 'free' && !cashFund?.isActive && (
            <div className="bg-gradient-to-r from-[#fff5ee] via-[#fffbf7] to-[#fff5ee] border border-orange-200/20 rounded-2xl p-5 mt-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
              <div className="flex items-start md:items-center gap-4 text-amber-950">
                <span className="text-2xl leading-none bg-amber-100 text-amber-700 w-11 h-11 flex items-center justify-center rounded-2xl shadow-sm border border-amber-200/40 shrink-0">⚡</span>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tracking-tight">Activar Lluvia de Sobres Premium</span>
                    <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-amber-200">Recomendado</span>
                  </div>
                  <span className="text-xs text-amber-900/80 font-medium tracking-normal mt-0.5 max-w-lg">
                    Permite aportes voluntarios directamente transferidos a tu banco en formato digital seguro con PSE, tarjetas o efectivo.
                  </span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.96 }}
              data-testid="boost-button"
              onClick={() => setBoostModal(true)}
              className="bg-[#994715] hover:bg-[#833e12] text-white text-xs md:text-sm font-extrabold tracking-wider py-3.5 px-6 rounded-full transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 self-stretch md:self-auto text-center border border-white/20"
            >
              <span>Activar Lluvia de Sobres</span>
                <span className="bg-amber-100/20 px-2.5 py-0.5 rounded-full text-xs font-black border border-white/10 whitespace-nowrap">$10.000 COP</span>
              </motion.button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] mt-6">
            <motion.button
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const url = `${window.location.origin}/e/${event.slug}`;
                if (navigator.share) {
                  navigator.share({ title: event.title, url });
                } else {
                  copyShareLink();
                }
              }}
              data-testid="share-event-button"
              className="group relative bg-[#1c1a1f] hover:bg-black text-white py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-[0_10px_20px_rgba(0,0,0,0.1)] overflow-hidden border border-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
              <Share2 className="w-[18px] h-[18px] text-rose-300 stroke-[2.5]" />
              <span>Compartir con Invitados</span>
            </motion.button>

            <a href={`/e/${event.slug}`} target="_blank" rel="noopener noreferrer">
              <motion.button
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="group relative w-full bg-surface/45 hover:bg-surface/70 backdrop-blur-md border border-white shadow-[0_8px_30px_rgba(162,27,83,0.03),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:shadow-[0_12px_40px_rgba(162,27,83,0.08),inset_0_1px_1px_rgba(255,255,255,1)] text-[#a21b53] py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                <span>Vista Previa de Invitado</span>
                <Eye className="w-[18px] h-[18px] text-[#a21b53] stroke-[2.2]" />
              </motion.button>
            </a>
          </div>

          {/* Utility Buttons */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-2 border-t border-rose-50">
            <motion.button
              whileHover={{ scale: 1.12, rotate: -5 }}
              whileTap={{ scale: 0.88 }}
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🎉 Te invito a ver mi lista de regalos: ${event.title}\n${window.location.origin}/e/${event.slug}`)}`, '_blank')}
              className="w-11 h-11 bg-gradient-to-b from-[#2cbd5e] to-[#25d366] flex items-center justify-center rounded-full text-white cursor-pointer shadow-md hover:shadow-green-500/20 transition-all"
              title="Compartir por WhatsApp"
            >
              <MessageSquare className="w-[22px] h-[22px] fill-white" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.12, rotate: 5 }}
              whileTap={{ scale: 0.88 }}
              onClick={copyShareLink}
              className="w-11 h-11 bg-white hover:bg-rose-50/50 border border-rose-100/40 flex items-center justify-center rounded-full text-gray-700 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
              title="Copiar enlace"
            >
              <Copy className="w-5 h-5 text-gray-500 stroke-[2.2]" />
            </motion.button>
          </div>

          {/* Event Details Section */}
          <div className="mt-8 pt-6 border-t border-rose-100/20">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#a21b53]" />
                <h3 className="text-gray-900 font-extrabold text-sm tracking-widest uppercase">Detalles del Evento</h3>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingDetails(true);
                  setTitleDraft(event.title);
                  setTypeDraft(event.eventType);
                  setDateDraft(event.eventDate ? event.eventDate.slice(0, 16) : '');
                  setLocationDraft(event.eventLocation ?? '');
                  setNoteDraft(event.eventNote ?? '');
                }}
                className="bg-[#a21b53]/5 hover:bg-[#a21b53]/10 border border-[#a21b53]/15 hover:border-[#a21b53]/30 text-[#a21b53] font-bold text-xs px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-all shadow-sm cursor-pointer group"
              >
                <Pencil className="w-3.5 h-3.5 text-[#a21b53] group-hover:rotate-12 transition-transform" />
                <span>Editar Evento</span>
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface border border-rose-100/30 rounded-2xl p-[18px] flex items-start gap-3.5 hover:bg-rose-50/20 transition-all shadow-sm">
                <div className="p-2.5 bg-[#a21b53]/5 text-[#a21b53] rounded-xl shrink-0">
                  <Calendar className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Fecha y Hora</span>
                  <span className="text-[#a21b53] text-[13px] font-extrabold leading-snug mt-1.5">
                    {event.eventDate ? formatDateTime(event.eventDate) : 'Sin definir'}
                  </span>
                </div>
              </div>

              <div className="bg-surface border border-rose-100/30 rounded-2xl p-[18px] flex items-start gap-3.5 hover:bg-rose-50/20 transition-all shadow-sm">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl shrink-0">
                  <MapPin className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ubicación / Lugar</span>
                  <span className="text-gray-800 text-[13px] font-extrabold leading-snug mt-1.5">{event.eventLocation || 'Sin definir'}</span>
                </div>
              </div>

              <div className="bg-surface border border-rose-100/30 rounded-2xl p-[18px] flex items-start gap-3.5 hover:bg-rose-50/20 transition-all shadow-sm">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <Info className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Indicaciones</span>
                  <span className="text-gray-700 text-xs font-semibold leading-normal mt-1.5 line-clamp-3">{event.eventNote || 'Sin notas'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showCoach && gifts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-gradient-to-r from-pink-50 via-white to-amber-50 border border-pink-100/50 rounded-3xl p-6 mb-8 shadow-sm overflow-hidden"
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-pink-100/40 rounded-full blur-2xl pointer-events-none" />
            <button
              onClick={() => setShowCoach(false)}
              className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white/60 transition-all cursor-pointer"
              aria-label="Cerrar guía"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-2 mb-4">
              <span className="text-xl">🚀</span>
              <div>
                <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">¡Tu evento está creado! Sigue estos pasos:</h3>
                <p className="text-xs text-gray-500 mt-0.5">En menos de 5 minutos tendrás tu lista lista para compartir.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              {[
                { step: 1, icon: '🎁', title: 'Agrega regalos', desc: 'Escribe lo que quieres recibir o elige sugerencias rápidas.', color: 'bg-pink-100 text-pink-700 border-pink-200' },
                { step: 2, icon: '🔗', title: 'Comparte el enlace', desc: 'Envía tu lista por WhatsApp, redes o copia el link.', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                { step: 3, icon: '🎉', title: 'Recibe confirmaciones', desc: 'Tus invitados apartan regalos sin registrarse, en tiempo real.', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
              ].map((item) => (
                <div key={item.step} className={`rounded-2xl p-4 border ${item.color} flex flex-col items-start text-left gap-2`}>
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-extrabold text-sm">{item.title}</p>
                    <p className="text-xs opacity-80 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <GiftManagement
          gifts={gifts}
          addingGift={addingGift}
          freeingGiftId={freeingGiftId}
          deletingGiftId={deletingGiftId}
          newGiftName={newGiftName}
          showSuggestions={showSuggestions}
          suggestions={suggestions}
          filteredSuggestions={filteredSuggestions}
          onAddGift={handleAddGift}
          onFreeGift={handleFreeGift}
          onDeleteGift={handleDeleteGift}
          onAddSuggestion={handleAddSuggestion}
          onNewGiftNameChange={setNewGiftName}
          onShowSuggestionsChange={setShowSuggestions}
        />

        <PhotoGallery
          photos={photos}
          uploading={uploading}
          uploadProgress={uploadProgress}
          deletingPhoto={deletingPhoto}
          deletePhotoConfirm={deletePhotoConfirm}
          fileInputRef={fileInputRef}
          onUpload={handleUploadPhoto}
          onDelete={handleDeletePhoto}
          onRequestDelete={setDeletePhotoConfirm}
          onDeleteConfirmClose={() => setDeletePhotoConfirm(null)}
          onSelectPreview={setSelectedPhotoForPreview}
          selectedPhotoForPreview={selectedPhotoForPreview}
        />
      </div>

      {/* Edit Details Modal */}
      <AnimatePresence>
        {editingDetails && (
          <div role="dialog" aria-modal="true" aria-label="Editar información del evento" className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-[32px] max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 flex flex-col gap-5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-pink-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

                <div className="flex items-center justify-between pb-3.5 border-b border-gray-200">
                <div className="flex items-center gap-1.5 text-left">
                  <span className="text-xl">✨</span>
                  <h4 className="text-lg font-black text-gray-900 tracking-tight">Editar Información de Evento</h4>
                </div>
                <button
                  onClick={() => setEditingDetails(false)}
                  aria-label="Cerrar"
                  data-testid="close-edit-modal"
                  className="p-2.5 text-gray-400 hover:text-gray-800 hover:bg-gray-50 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); handleUpdateDetails(); }}
                className="space-y-4 text-left"
              >
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nombre del evento</label>
                  <input
                    id="edit-title"
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#d87c9b]/25 bg-white font-bold"
                    autoComplete="off"
                    enterKeyHint="next"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tipo de evento</label>
                    <select
                      id="edit-type"
                      value={typeDraft}
                      onChange={(e) => setTypeDraft(e.target.value as EventType)}
                      className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#d87c9b]/25 bg-white font-bold text-gray-700"
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Fecha y Hora</label>
                    <input
                      id="edit-date"
                      type="datetime-local"
                      value={dateDraft}
                      onChange={(e) => setDateDraft(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#d87c9b]/25 bg-white font-bold text-gray-700"
                    />
                  </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Lugar del evento</label>
                  <input
                    id="edit-location"
                    type="text"
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#d87c9b]/25 bg-white font-bold text-gray-700"
                    placeholder="Ej: Salón de eventos, Ciudad"
                    autoComplete="street-address"
                    inputMode="text"
                    enterKeyHint="next"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notas para invitados</label>
                  <textarea
                    id="edit-note"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#d87c9b]/25 bg-white font-semibold text-gray-700 resize-none"
                    placeholder="Ej: No se aceptan regalos envueltos"
                  />
                </div>

                <div className="flex justify-end gap-3.5 pt-4 border-t border-gray-200 mt-5">
                  <button
                    type="button"
                    onClick={() => setEditingDetails(false)}
                    className="px-5 py-3 text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    Salir sin guardar
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    data-testid="save-event-changes"
                    disabled={updatingDetails}
                    className="bg-[#c52367] hover:bg-[#a21b53] text-white px-6 py-3.5 rounded-full text-xs font-black tracking-wide shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {updatingDetails ? '...' : 'Guardar Cambios'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lluvia de Sobres / Boost Modal */}
      <AnimatePresence>
        {boostModal && (
          <div role="dialog" aria-modal="true" aria-label="Activar Lluvia de Sobres" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-surface rounded-[36px] max-w-md w-full p-6 md:p-8 shadow-2xl border border-orange-100 flex flex-col gap-4 text-center relative overflow-hidden"
            >
              <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-amber-200/20 rounded-full blur-3xl -z-10 pointer-events-none" />

              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-700 rounded-3xl flex items-center justify-center mx-auto text-white text-3xl shadow-md border border-amber-200/50">
                ⚡
              </div>

              <h4 className="text-xl font-black text-[#93400e] tracking-tight">
                Activar Lluvia de Sobres
              </h4>
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed font-semibold">
                <strong>Pago único de $10.000 COP.</strong> Tus invitados podrán enviarte dinero directo a tu cuenta por PSE, tarjeta o Nequi. Válido por 30 días.
              </p>

              <div className="bg-amber-50/70 p-[18px] rounded-2xl border border-amber-200/50 text-left space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                  <Check className="w-4 h-4 text-amber-700 font-extrabold shrink-0" />
                  <span>Cada invitado paga con PSE, tarjeta, Nequi o Daviplata</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                  <Check className="w-4 h-4 text-amber-700 font-extrabold shrink-0" />
                  <span>El dinero llega directo a tu cuenta bancaria</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                  <Check className="w-4 h-4 text-amber-700 font-extrabold shrink-0" />
                  <span>Recibes comprobante automático de cada aporte</span>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 font-semibold">Comisión del 5% al retirar el dinero. Procesado por Mercado Pago. Pago único de $10.000 COP — no es una suscripción.</p>

              <div className="flex flex-col gap-2.5 mt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="pay-boost-button"
                onClick={handleBoost}
                  disabled={boostLoading}
                  className="w-full bg-[#994715] hover:bg-[#833e12] text-white py-3.5 rounded-full text-xs font-black tracking-wider uppercase transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                    {boostLoading ? '...' : 'PAGAR Y ACTIVAR — $10.000 COP'}
                </motion.button>
                <button
                  onClick={() => setBoostModal(false)}
                  disabled={boostLoading}
                  className="w-full bg-transparent text-gray-400 hover:text-gray-700 text-xs py-1.5 font-extrabold cursor-pointer disabled:opacity-50"
                >
                  Ahora no, gracias
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toggle Confirm Modal */}
      {toggleConfirm && (
        <ConfirmModal
          message={event.isActive
            ? '¿Pausar el evento? Los invitados verán la página como "no disponible" hasta que lo actives de nuevo.'
            : '¿Activar el evento? Los invitados podrán ver la lista, apartar regalos y enviar dinero.'}
          onConfirm={toggleActive}
          onClose={() => setToggleConfirm(false)}
          loading={toggling}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center py-3 px-4 pb-safe crystal-nav border-t border-white/20 shadow-[0_-4px_20px_rgba(177,14,107,0.1)] z-50 rounded-t-xl">
        <Link to="/dashboard" className="flex flex-col items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full active:scale-90 duration-200">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
          <span className="font-label-md text-label-md">Eventos</span>
        </Link>
        <Link to="/pricing" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary-container transition-all active:scale-90 duration-200 relative">
          <span className="material-symbols-outlined">card_giftcard</span>
          <span className="font-label-md text-label-md">Planes</span>
          <span className="absolute -top-0.5 -right-2 text-[7px] font-black px-1 py-0.5 rounded-full bg-primary/10 text-primary">
            {user?.tier === 'free' ? 'FREE' : 'PRO'}
          </span>
        </Link>
        <Link to="/account" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary-container transition-all active:scale-90 duration-200">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md">Cuenta</span>
        </Link>
      </nav>
    </div>
  );
}

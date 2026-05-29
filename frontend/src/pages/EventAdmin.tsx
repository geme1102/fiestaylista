import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { getCashFund, boostEvent } from '../services/cashFund';
import ShareButtons from '../components/ShareButtons';
import GiftCard from '../components/GiftCard';
import { showToast } from '../hooks/useToast';
import { uploadPhoto, addPhoto } from '../services/events';
import { EVENT_LABELS, EVENT_ICONS, type EventType, type Gift, type Photo } from '../types';
import { GIFT_SUGGESTIONS } from '../data/giftSuggestions';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageWithSkeleton from '../components/ImageWithSkeleton';

interface AdminEvent {
  id: string; title: string; eventType: EventType; slug: string; isActive: boolean; boostedUntil?: string;
}

const EVENT_TYPES: { value: EventType; icon: string; label: string }[] = [
  { value: 'BABY_SHOWER', icon: '🍼', label: 'Baby Shower' },
  { value: 'WEDDING', icon: '💍', label: 'Boda' },
  { value: 'BIRTHDAY', icon: '🎂', label: 'Cumpleaños' },
  { value: 'BAPTISM', icon: '🕊️', label: 'Bautizo' },
  { value: 'COMMUNION', icon: '✨', label: 'Comunión' },
];

function ConfirmModal({ message, onConfirm, onClose, loading, confirmLabel = 'Eliminar' }: { message: string; onConfirm: () => void; onClose: () => void; loading?: boolean; confirmLabel?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-sm bg-white dark:bg-gray-800 p-6 rounded-t-2xl sm:rounded-2xl animate-slide-up shadow-xl">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded-xl hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-fuchsia-500 rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventAdmin() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const [newGiftName, setNewGiftName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingType, setEditingType] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState<EventType>('BABY_SHOWER');
  const [uploading, setUploading] = useState(false);

  const [cashFund, setCashFund] = useState<{ collectedAmount?: number; isActive?: boolean } | null>(null);
  const [boostModal, setBoostModal] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);

  const [deletePhotoConfirm, setDeletePhotoConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id]);

  useEffect(() => {
    if (!event?.slug) return;
    const baseUrl = import.meta.env.VITE_API_URL ?? '';
    const es = new EventSource(`${baseUrl}/api/events/${id}/gifts/subscribe`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'connected') return;
        showToast(`🎉 ${data.claimedBy} apartó: ${data.giftName}`, 'success');
        loadEvent();
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [id, event?.slug]);

  async function loadEvent() {
    try {
      const [eventRes, giftsRes, photosRes, fundRes] = await Promise.all([
        apiClient.get<{ event: AdminEvent }>(`/api/events/${id}`),
        apiClient.get<{ gifts: Gift[] }>(`/api/events/${id}/gifts`),
        apiClient.get<{ photos: Photo[] }>(`/api/events/${id}/photos`),
        getCashFund(id!),
      ]);
      setEvent(eventRes.event);
      setTitleDraft(eventRes.event.title);
      setTypeDraft(eventRes.event.eventType);
      setGifts(giftsRes.gifts || []);
      setPhotos(photosRes.photos || []);
      if (fundRes.cashFund) setCashFund(fundRes.cashFund);
    } catch (err) {
      showToast('Error al cargar el evento', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleAddGift = async () => {
    if (!newGiftName.trim()) return;
    try {
      const res = await apiClient.post<{ gift: Gift }>(`/api/events/${id}/gifts`, { name: newGiftName.trim() });
      setGifts((prev) => [...prev, res.gift]);
      setNewGiftName('');
      setShowSuggestions(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al agregar regalo', 'error');
    }
  };

  const handleDeleteGift = async (giftId: string) => {
    try {
      await apiClient.del(`/api/events/${id}/gifts/${giftId}`);
      setGifts((prev) => prev.filter((g) => g.id !== giftId));
    } catch (err) {
      showToast('Error al eliminar regalo', 'error');
    }
  };

  const handleFreeGift = async (giftId: string) => {
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${id}/gifts/${giftId}/free`);
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
    } catch (err) {
      showToast('Error al liberar regalo', 'error');
    }
  };

  const handleUpdateTitle = async () => {
    if (!titleDraft.trim()) return;
    try {
      const res = await apiClient.put<{ event: AdminEvent }>(`/api/events/${id}`, { title: titleDraft.trim() });
      setEvent((prev) => prev ? { ...prev, title: res.event.title } : prev);
      setEditingTitle(false);
      showToast('Título actualizado', 'success');
    } catch (err) {
      showToast('Error al actualizar título', 'error');
    }
  };

  const handleUpdateType = async () => {
    try {
      const res = await apiClient.put<{ event: AdminEvent }>(`/api/events/${id}`, { eventType: typeDraft });
      setEvent((prev) => prev ? { ...prev, eventType: res.event.eventType } : prev);
      setEditingType(false);
      showToast('Tipo de evento actualizado', 'success');
    } catch (err) {
      showToast('Error al actualizar tipo de evento', 'error');
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Solo se permiten imágenes', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen no debe superar los 5MB', 'error');
      return;
    }

    setUploading(true);
    try {
      const { url } = await uploadPhoto(file);
      const res = await addPhoto(id!, url);
      setPhotos((prev) => [...prev, res.photo]);
    } catch (err) {
      showToast('Error al subir foto', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setDeletePhotoConfirm(null);
    try {
      await apiClient.del(`/api/events/${id}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      showToast('Foto eliminada', 'success');
    } catch (err) {
      showToast('Error al eliminar foto', 'error');
    }
  };

  const handleBoost = async () => {
    setBoostLoading(true);
    try {
      const res = await boostEvent(id!);
      if (res.url) {
        window.location.href = res.url;
      } else {
        showToast('Evento boosteado 🚀', 'success');
        setBoostModal(false);
        setEvent((prev) => prev ? { ...prev, boostedUntil: res.boostedUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } : prev);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al boostear', 'error');
    } finally {
      setBoostLoading(false);
    }
  };

  const toggleActive = async () => {
    try {
      await apiClient.put(`/api/events/${id}`, { isActive: !event?.isActive });
      setEvent((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev);
    } catch (err) {
      showToast('Error al actualizar', 'error');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-10">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-2xl w-1/3" />
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-rose-100 to-fuchsia-100 dark:from-rose-900/20 dark:to-fuchsia-900/20 flex items-center justify-center text-4xl">
          😕
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Evento no encontrado</p>
        <Link to="/dashboard" className="text-rose-600 font-medium inline-block">Volver al dashboard</Link>
      </div>
    );
  }

  const suggestions = GIFT_SUGGESTIONS[event.eventType] || [];
  const filteredSuggestions = suggestions.filter((s) =>
    s.toLowerCase().includes(newGiftName.toLowerCase()) &&
    !gifts.some((g) => g.name.toLowerCase() === s.toLowerCase())
  );
  const isBoosted = event.boostedUntil && new Date(event.boostedUntil) > new Date();

  return (
    <div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link to="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-300">Mis Eventos</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">{event.title}</span>
      </div>

      <div className="rounded-2xl p-6 sm:p-8 mb-8 backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 shadow-[0_10px_25px_-5px_rgba(236,72,153,0.2)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-3xl shrink-0">{EVENT_ICONS[event.eventType]}</span>
            <div className="min-w-0 flex-1">
              {editingTitle ? (
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-lg font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 min-h-[44px]"
                    autoFocus
                  />
                  <button onClick={handleUpdateTitle} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium min-h-[44px]">Guardar</button>
                  <button onClick={() => setEditingTitle(false)} className="px-4 py-2 text-sm text-gray-500 min-h-[44px]">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1
                    className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-rose-600 transition-colors truncate font-outfit"
                    onClick={() => setEditingTitle(true)}
                    title="Editar título"
                  >
                    {event.title}
                  </h1>
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label="Editar título del evento"
                  >
                    ✏️
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                {editingType ? (
                  <div className="flex gap-2 flex-wrap items-center">
                    {EVENT_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTypeDraft(t.value)}
                        className={`px-2 py-1 text-xs rounded-lg font-medium transition-all ${
                          typeDraft === t.value
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 ring-2 ring-rose-500'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                    <button onClick={handleUpdateType} className="px-3 py-1 text-xs bg-rose-500 text-white rounded-lg font-medium min-h-[32px]">Guardar</button>
                    <button onClick={() => setEditingType(false)} className="px-3 py-1 text-xs text-gray-500 min-h-[32px]">Cancelar</button>
                  </div>
                ) : (
                  <span
                    className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-rose-600 transition-colors flex items-center gap-1"
                    onClick={() => setEditingType(true)}
                  >
                    {EVENT_LABELS[event.eventType]}
                    <span className="text-xs opacity-50">✏️</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleActive}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                event.isActive ? 'bg-rose-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={event.isActive ? 'Desactivar evento' : 'Activar evento'}
            >
              <span className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                event.isActive ? 'translate-x-5' : ''
              }`} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {event.isActive ? 'Activo' : 'Inactivo'}
            </span>
            {isBoosted && (
              <span className="ml-2 px-3 py-1 min-h-[22px] flex items-center text-xs font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                BOOST
              </span>
            )}
          </div>
        </div>

        {!isBoosted && user?.tier === 'free' && !cashFund?.isActive && (
          <div className="mt-5 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 rounded-xl p-4 flex items-center justify-between overflow-hidden relative">
            <div className="flex items-center gap-2 relative z-10">
              <span className="text-amber-600 dark:text-amber-400 text-lg">⚡</span>
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Aumenta tus regalos con Boost
              </span>
            </div>
            <button onClick={() => setBoostModal(true)} className="relative z-10 bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px]">
              Boost $4.99
            </button>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              const url = `${window.location.origin}/e/${event.slug}`;
              if (navigator.share) {
                navigator.share({ title: event.title, url });
              } else {
                navigator.clipboard.writeText(url);
                showToast('Enlace copiado', 'success');
              }
            }}
            className="flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl text-sm font-semibold hover:shadow-lg transition-all min-h-[44px]"
          >
            🔗 Compartir
          </button>
          <a href={`/e/${event.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border border-gray-300/50 dark:border-gray-600/50 text-gray-900 dark:text-white py-3 rounded-xl text-sm font-semibold hover:shadow-lg transition-all min-h-[44px]">
            👁️ Vista previa
          </a>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
          <ShareButtons slug={event.slug} title={event.title} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mt-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 font-outfit">Regalos ({gifts.length})</h2>

          <div className="relative mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={newGiftName}
                onChange={(e) => { setNewGiftName(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleAddGift(); } }}
                placeholder="Agregar regalo..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 transition-all min-h-[44px]"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAddGift}
                disabled={!newGiftName.trim()}
                className="px-5 py-3 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 min-h-[44px]"
                aria-label="Agregar regalo"
              >
                +
              </motion.button>
            </div>

            {showSuggestions && newGiftName && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setNewGiftName(s); setShowSuggestions(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:bg-rose-900/20 transition-colors min-h-[44px]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
                {suggestions
                  .filter((s) => !gifts.some((g) => g.name.toLowerCase() === s.toLowerCase()))
                  .slice(0, 6)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        apiClient.post<{ gift: Gift }>(`/api/events/${id}/gifts`, { name: s })
                          .then((res) => setGifts((prev) => [...prev, res.gift]))
                          .catch(() => showToast('Error al agregar regalo', 'error'));
                      }}
                      className="whitespace-nowrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-full text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shrink-0"
                    >
                      + {s}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {gifts.length === 0 && (
            <div className="rounded-2xl p-6 text-center backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-rose-100 to-fuchsia-100 dark:from-rose-900/20 dark:to-fuchsia-900/20 flex items-center justify-center text-2xl">
                🎁
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Agrega regalos sugeridos para tu evento</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.slice(0, 8).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      apiClient.post<{ gift: Gift }>(`/api/events/${id}/gifts`, { name: s })
                        .then((res) => setGifts((prev) => [...prev, res.gift]))
                        .catch(() => showToast('Error al agregar regalo', 'error'));
                    }}
                    className="px-3 py-2 min-h-[44px] text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-rose-50 dark:bg-rose-900/20 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {gifts.map((gift) => (
              <GiftCard
                key={gift.id}
                gift={gift}
                onFree={handleFreeGift}
                onDelete={handleDeleteGift}
                isAdmin
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 font-outfit">Fotos ({photos.length})</h2>

          {photos.length === 0 && (
            <div className="rounded-2xl p-6 text-center mb-4 backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 shadow-sm">
              <p className="text-gray-500 dark:text-gray-400">Aún no hay fotos. Sube la primera.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            {photos.map((photo) => (
              <motion.div
                key={photo.id}
                whileHover={{ scale: 1.02 }}
                className="relative group rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <ImageWithSkeleton src={photo.url} alt={photo.caption || 'Foto del evento'} aspectRatio="aspect-square" />
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-white text-xs truncate">{photo.caption}</p>
                  </div>
                )}
                <button
                  onClick={() => setDeletePhotoConfirm(photo.id)}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-md text-white rounded-full text-sm opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  aria-label={`Eliminar foto${photo.caption ? `: ${photo.caption}` : ''}`}
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </div>

          <label className="col-span-2 flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-rose-300/60 dark:border-rose-700/40 bg-rose-50/30 dark:bg-rose-900/10 rounded-xl cursor-pointer hover:bg-rose-50/60 dark:hover:bg-rose-900/20 transition-colors min-h-[120px]">
            <span className="text-2xl text-rose-500 mb-2">☁️</span>
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              {uploading ? 'Subiendo...' : 'Subir más fotos'}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPG o PNG hasta 5MB</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadPhoto}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {deletePhotoConfirm && (
        <ConfirmModal
          message="¿Eliminar esta foto? Esta acción no se puede deshacer."
          onConfirm={() => handleDeletePhoto(deletePhotoConfirm)}
          onClose={() => setDeletePhotoConfirm(null)}
        />
      )}

      {boostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setBoostModal(false); }}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative z-10">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center space-y-2 relative overflow-hidden">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white text-3xl">💵</span>
              </div>
              <h3 className="text-lg font-bold text-white">Activar Lluvia de Sobres</h3>
              <p className="text-white/80 text-sm">Convierte tus regalos en dinero efectivo</p>
            </div>
            <div className="p-6 space-y-4">
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-amber-500 shrink-0 mt-0.5">✅</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Recibe el 100% del valor de tus regalos en tu cuenta bancaria.</p>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-500 shrink-0 mt-0.5">✅</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tus invitados pueden pagar con cualquier tarjeta o PSE.</p>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-500 shrink-0 mt-0.5">✅</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Habilitado para transferencias internacionales.</p>
                </li>
              </ul>
              <button onClick={handleBoost} disabled={boostLoading} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center min-h-[56px]">
                {boostLoading ? <LoadingSpinner size="sm" /> : 'Pagar $4.99'}
              </button>
              <button onClick={() => setBoostModal(false)} disabled={boostLoading} className="w-full text-sm text-gray-500 dark:text-gray-400 py-2 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Tal vez luego
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

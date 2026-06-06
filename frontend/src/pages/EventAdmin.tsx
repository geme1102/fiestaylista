import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { getCashFund, boostEvent } from '../services/cashFund';
import GiftCard from '../components/GiftCard';
import { showToast } from '../hooks/useToast';
import { uploadPhoto, addPhoto } from '../services/events';
import { EVENT_LABELS, EVENT_ICONS, type EventType, type Gift, type Photo } from '../types';
import { GIFT_SUGGESTIONS } from '../data/giftSuggestions';
import { validateRedirectUrl } from '../utils/format';
import ImageWithSkeleton from '../components/ImageWithSkeleton';
import { ConfirmModal } from '../components/ConfirmModal';

interface AdminEvent {
  id: string; title: string; eventType: EventType; slug: string; isActive: boolean; boostedUntil?: string;
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
    if (!id) return;
    let es: EventSource | null = null;
    let cancelled = false;

    async function connectSSE() {
      try {
        const { token } = await apiClient.post<{ token: string }>(`/api/events/${id}/gifts/sse-token`);
        if (cancelled) return;
        const baseUrl = import.meta.env.VITE_API_URL ?? '';
        es = new EventSource(`${baseUrl}/api/events/${id}/gifts/subscribe?token=${token}`);
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'connected') return;
            showToast(`🎉 ${data.claimedBy} apartó: ${data.giftName}`, 'success');
            loadEvent();
          } catch (err) {
            console.warn('[SSE] Error parsing message:', err);
          }
        };
        es.onerror = () => console.warn('[SSE] Conexión perdida');
      } catch {
        console.warn('[SSE] No se pudo conectar al stream de eventos');
      }
    }

    connectSSE();
    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [id]);

  async function loadEvent() {
    try {
      const [eventRes, fundRes] = await Promise.all([
        apiClient.get<{ event: AdminEvent & { gifts?: Gift[]; photos?: Photo[] } }>(`/api/events/${id}`),
        getCashFund(id!),
      ]);
      const ev = eventRes.event;
      setEvent(ev);
      setTitleDraft(ev.title);
      setTypeDraft(ev.eventType);
      setGifts(ev.gifts || []);
      setPhotos(ev.photos || []);
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
    if (file.size > 10 * 1024 * 1024) {
      showToast('La imagen no debe superar los 10MB', 'error');
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
        const validatedUrl = validateRedirectUrl(res.url);
        if (validatedUrl) {
          window.location.href = validatedUrl;
        } else {
          showToast('URL de pago inválida', 'error');
          setBoostLoading(false);
        }
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
      <div className="animate-pulse space-y-6 py-10 px-container-margin">
        <div className="h-12 bg-surface-container-high rounded-2xl w-1/3" />
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="h-6 bg-surface-container-high rounded-lg w-1/4" />
            <div className="h-12 bg-surface-container-high rounded-xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface-container-high rounded-2xl" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-6 bg-surface-container-high rounded-lg w-1/4" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-surface-container-high rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 px-container-margin">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-fixed to-primary-fixed/50 flex items-center justify-center text-4xl">
          😕
        </div>
        <p className="text-on-surface-variant mb-4">Evento no encontrado</p>
        <Link to="/dashboard" className="text-primary font-medium inline-block">Volver al dashboard</Link>
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
    <div className="font-body-md text-body-md pb-24">
      {/* Top App Bar */}
      <nav className="bg-surface/80 backdrop-blur-xl border-b border-white/20 shadow-sm fixed top-0 z-50 flex justify-between items-center px-container-margin h-16 w-full">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="active:scale-95 duration-200 text-primary">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-headline-md text-primary">Administrar Evento</h1>
        </div>
        <div className="w-10" />
      </nav>

      <main className="mt-20 px-container-margin space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
          <Link to="/dashboard" className="hover:text-primary transition-colors">Mis Eventos</Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-primary font-bold">{event.title}</span>
        </div>

        {/* Header Glass Card */}
        <section className="glass rounded-xl p-6 glow-shadow-pro relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-2xl">
                {EVENT_ICONS[event.eventType]}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {editingTitle ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface font-headline-md text-headline-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                      <button onClick={handleUpdateTitle} className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium">Guardar</button>
                      <button onClick={() => setEditingTitle(false)} className="px-3 py-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <h2 className="font-headline-md text-headline-md text-on-surface">{event.title}</h2>
                      <button onClick={() => setEditingTitle(true)} className="text-primary">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 text-on-surface-variant font-label-md">
                  {editingType ? (
                    <div className="flex gap-2 flex-wrap items-center">
                      {EVENT_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTypeDraft(t.value)}
                          className={`px-2 py-1 text-xs rounded-lg font-medium transition-all ${
                            typeDraft === t.value
                              ? 'bg-primary-fixed text-primary-fixed-dim ring-2 ring-primary'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {t.icon} {t.label}
                        </button>
                      ))}
                      <button onClick={handleUpdateType} className="px-3 py-1 text-xs bg-primary text-white rounded-lg font-medium">Guardar</button>
                      <button onClick={() => setEditingType(false)} className="px-3 py-1 text-xs text-on-surface-variant hover:text-on-surface transition-colors">Cancelar</button>
                    </div>
                  ) : (
                    <span onClick={() => setEditingType(true)} className="cursor-pointer flex items-center gap-1">
                      Tipo: {EVENT_LABELS[event.eventType]}
                      <span className="material-symbols-outlined text-sm">expand_more</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={event.isActive} onChange={toggleActive} className="sr-only peer" />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
              </label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {event.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Boost Badge */}
          {!isBoosted && user?.tier === 'free' && !cashFund?.isActive && (
            <div className="bg-secondary-fixed/30 border border-secondary/20 rounded-lg p-3 flex justify-between items-center mb-6 overflow-hidden relative">
              <div className="shimmer-bg absolute inset-0 pointer-events-none" />
              <div className="flex items-center gap-2 relative z-10">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                <span className="font-label-md text-secondary">Aumenta tus regalos con Boost</span>
              </div>
              <button onClick={() => setBoostModal(true)} className="bg-secondary text-white px-4 py-1.5 rounded-full font-label-md active:scale-95 transition-transform relative z-10">
                Boost
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
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
              className="flex items-center justify-center gap-2 bg-on-surface text-surface py-3 rounded-xl font-label-md active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">share</span> Compartir
            </button>
            <a href={`/e/${event.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border border-outline/30 text-on-surface py-3 rounded-xl font-label-md active:scale-95 transition-all">
              Vista previa <span className="material-symbols-outlined text-sm">visibility</span>
            </a>
          </div>

          {/* Social Share Row */}
          <div className="mt-4 flex gap-4 justify-center">
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🎉 Te invito a ver mi lista de regalos: ${event.title}\n${window.location.origin}/e/${event.slug}`)}`, '_blank')}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#25D366] text-white active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">chat</span>
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/e/${event.slug}`); showToast('Enlace copiado', 'success'); }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-variant text-on-surface active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">content_copy</span>
            </button>
          </div>
        </section>

        {/* Regalos Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md flex items-center gap-2">
              Regalos <span className="text-primary font-bold">({gifts.length})</span>
            </h3>
            <span className="material-symbols-outlined text-on-surface-variant">featured_play_list</span>
          </div>

          {/* Add Gift */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newGiftName}
                onChange={(e) => { setNewGiftName(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddGift(); }}
                placeholder="Añadir un regalo..."
                className="w-full bg-white border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 shadow-sm outline-none text-on-surface"
              />
              {/* Suggestions Dropdown */}
              {showSuggestions && newGiftName && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-outline-variant rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setNewGiftName(s); setShowSuggestions(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-primary-fixed transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAddGift}
              disabled={!newGiftName.trim()}
              className="bg-primary text-white w-12 h-12 rounded-xl flex items-center justify-center glow-shadow-pro active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined">add</span>
            </motion.button>
          </div>

          {/* Quick Suggestions */}
          {suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 hide-scrollbar">
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
                    className="whitespace-nowrap bg-white border border-outline-variant px-4 py-2 rounded-full font-label-md text-on-surface-variant flex items-center gap-1 active:bg-primary-fixed transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">add</span> {s}
                  </button>
                ))}
            </div>
          )}

          {/* Gift List */}
          {gifts.length === 0 && (
            <div className="glass p-6 rounded-xl text-center">
              <p className="text-on-surface-variant">No hay regalos aún. ¡Agrega el primero!</p>
            </div>
          )}
          <div className="space-y-3">
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
        </section>

        {/* Fotos Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md flex items-center gap-2">
              Fotos <span className="text-primary font-bold">({photos.length})</span>
            </h3>
            <span className="material-symbols-outlined text-on-surface-variant">photo_library</span>
          </div>

          {photos.length === 0 && (
            <div className="glass p-6 rounded-xl text-center">
              <p className="text-on-surface-variant">Aún no hay fotos. Sube la primera.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm group">
                <ImageWithSkeleton src={photo.url} alt={photo.caption || 'Foto del evento'} aspectRatio="aspect-square" />
                <button
                  onClick={() => setDeletePhotoConfirm(photo.id)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
            {/* Upload Area */}
            <label className="col-span-2 border-2 border-dashed border-primary/40 bg-primary/5 rounded-xl py-8 flex flex-col items-center justify-center gap-2 cursor-pointer active:bg-primary/10 transition-colors">
              <span className="material-symbols-outlined text-primary text-3xl">cloud_upload</span>
              <p className="font-bold text-primary">{uploading ? 'Subiendo...' : 'Subir más fotos'}</p>
              <p className="text-caption text-on-surface-variant">JPG o PNG hasta 10MB</p>
              <input type="file" accept="image/*" onChange={handleUploadPhoto} disabled={uploading} className="hidden" />
            </label>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center py-3 px-4 pb-safe bg-surface/80 backdrop-blur-xl border-t border-white/20 shadow-[0_-4px_20px_rgba(177,14,107,0.1)] z-50 rounded-t-xl">
        <Link to="/dashboard" className="flex flex-col items-center justify-center text-primary relative after:content-[''] after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full active:scale-90 duration-200">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
          <span className="font-label-md text-label-md">Eventos</span>
        </Link>
        <Link to="/pricing" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary-container transition-all active:scale-90 duration-200">
          <span className="material-symbols-outlined">card_giftcard</span>
          <span className="font-label-md text-label-md">Planes</span>
        </Link>
        <Link to="/account" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary-container transition-all active:scale-90 duration-200">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md">Cuenta</span>
        </Link>
      </nav>

      {/* Delete Photo Confirmation Modal */}
      {deletePhotoConfirm && (
        <ConfirmModal
          message="¿Eliminar esta foto? Esta acción no se puede deshacer."
          onConfirm={() => handleDeletePhoto(deletePhotoConfirm)}
          onClose={() => setDeletePhotoConfirm(null)}
        />
      )}

      {/* Boost Modal */}
      {boostModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" id="modalBoost">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBoostModal(false)} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-surface w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative z-10"
          >
            <div className="bg-secondary p-6 text-center space-y-2 relative overflow-hidden">
              <div className="shimmer-bg absolute inset-0 opacity-30 pointer-events-none" />
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-white">Activar Lluvia de Sobres</h2>
              <p className="text-white/80 font-label-md">Convierte tus regalos en dinero efectivo</p>
            </div>
            <div className="p-6 space-y-4">
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <p className="text-on-surface-variant text-body-md">Recibe el 100% del valor de tus regalos en tu cuenta bancaria.</p>
                </li>
                <li className="flex gap-3">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <p className="text-on-surface-variant text-body-md">Tus invitados pueden pagar con cualquier tarjeta o PSE.</p>
                </li>
                <li className="flex gap-3">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <p className="text-on-surface-variant text-body-md">Habilitado para transferencias internacionales.</p>
                </li>
              </ul>
              <button
                onClick={handleBoost}
                disabled={boostLoading}
                className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform disabled:opacity-50"
              >
                {boostLoading ? '...' : 'Pagar $10.000 COP'}
              </button>
              <button onClick={() => setBoostModal(false)} disabled={boostLoading} className="w-full text-on-surface-variant font-label-md py-2 hover:text-on-surface transition-colors">
                Tal vez luego
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}



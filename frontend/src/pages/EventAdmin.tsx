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

interface AdminEvent {
  id: string; title: string; eventType: EventType; slug: string; isActive: boolean; boostedUntil?: string;
}
import { GIFT_SUGGESTIONS } from '../data/giftSuggestions';
import LoadingSpinner from '../components/LoadingSpinner';

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
  const [titleDraft, setTitleDraft] = useState('');
  const [uploading, setUploading] = useState(false);

  const [cashFund, setCashFund] = useState<{ collectedAmount?: number; isActive?: boolean } | null>(null);
  const [boostModal, setBoostModal] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id]);

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
      const res = await apiClient.put<{ event: any }>(`/api/events/${id}`, { title: titleDraft.trim() });
      setEvent((prev) => prev ? { ...prev, title: res.event.title } : prev);
      setEditingTitle(false);
      showToast('Título actualizado', 'success');
    } catch (err) {
      showToast('Error al actualizar título', 'error');
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
    if (!confirm('¿Eliminar esta foto?')) return;
    try {
      await apiClient.del(`/api/events/${id}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
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
        <img src="/illustrations/illustration-404.png" alt="" loading="lazy" className="w-48 h-48 mx-auto mb-6" />
        <p className="text-gray-500 dark:text-gray-400 mb-4">Evento no encontrado</p>
        <Link to="/dashboard" className="text-pink-600 font-medium inline-block">Volver al dashboard</Link>
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

      <div
        className="rounded-2xl p-6 sm:p-8 mb-8"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
        }}
      >
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
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-lg font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 min-h-[44px]"
                    autoFocus
                  />
                  <button onClick={handleUpdateTitle} className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium min-h-[44px]">Guardar</button>
                  <button onClick={() => setEditingTitle(false)} className="px-4 py-2 text-sm text-gray-500 min-h-[44px]">Cancelar</button>
                </div>
              ) : (
                <h1
                  className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-pink-600 transition-colors truncate"
                  onClick={() => setEditingTitle(true)}
                  title="Editar título"
                >
                  {event.title}
                </h1>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">{EVENT_LABELS[event.eventType]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-3 py-1 min-h-[34px] flex items-center text-xs font-medium rounded-full cursor-pointer ${
                event.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'
              }`}
              onClick={toggleActive}
            >
              {event.isActive ? 'Activo' : 'Inactivo'}
            </span>
            {isBoosted && (
              <span className="px-3 py-1 min-h-[34px] flex items-center text-xs font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                BOOST
              </span>
            )}
            {!isBoosted && user?.tier === 'free' && !cashFund?.isActive && (
              <button
                onClick={() => setBoostModal(true)}
                className="px-3 py-1 min-h-[34px] text-xs font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full hover:bg-emerald-200 transition-colors"
              >
                Boost $4.99
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <ShareButtons slug={event.slug} title={event.title} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mt-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Regalos ({gifts.length})</h2>

          <div className="relative mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={newGiftName}
                onChange={(e) => { setNewGiftName(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleAddGift(); } }}
                placeholder="Agregar regalo..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 transition-all min-h-[44px]"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAddGift}
                disabled={!newGiftName.trim()}
                className="px-5 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 min-h-[44px]"
              >
                +
              </motion.button>
            </div>

            {showSuggestions && newGiftName && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setNewGiftName(s); setShowSuggestions(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-pink-50 dark:bg-pink-900/20 transition-colors min-h-[44px]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {gifts.length === 0 && (
            <div
              className="rounded-2xl p-6 text-center"
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.4)',
              }}
            >
              <img src="/illustrations/empty-admin.png" alt="" loading="lazy" className="w-48 h-48 mx-auto mb-4" />
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
                    className="px-3 py-2 min-h-[44px] text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-pink-50 dark:bg-pink-900/20 transition-colors"
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Fotos ({photos.length})</h2>

          {photos.length === 0 && (
            <div
              className="rounded-2xl p-6 text-center mb-4"
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.4)',
              }}
            >
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
                <img src={photo.url} alt={photo.caption || ''} loading="lazy" className="w-full h-40 object-cover" />
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full text-sm opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  aria-label="Eliminar foto"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </div>

          <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-pink-400 dark:hover:border-pink-600 transition-colors min-h-[60px]">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {uploading ? 'Subiendo...' : '📸 Subir foto'}
            </span>
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

      {boostModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setBoostModal(false); }}>
          <div className="w-full sm:max-w-md bg-white dark:bg-gray-800 p-6 rounded-t-2xl sm:rounded-2xl shadow-xl" style={{ animation: 'slide-up 0.3s ease-out' }}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Activar Lluvia de Sobres</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Por solo <strong className="text-gray-900 dark:text-white">$4.99</strong> activa el Cash Fund para este evento durante 30 días.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setBoostModal(false)} disabled={boostLoading} className="flex-1 py-3 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded-xl hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleBoost} disabled={boostLoading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center">
                {boostLoading ? <LoadingSpinner size="sm" /> : 'Pagar $4.99'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

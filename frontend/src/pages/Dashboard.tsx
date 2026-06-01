import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { THEME_COLORS, EVENT_LABELS, EVENT_ICONS, TIER_LIMITS, type EventType, type Event } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCOP } from '../utils/format';
import { cn } from '../utils/cn';

const ONBOARDING_TYPES: EventType[] = ['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION'];

function VerificationBanner({ onRefresh, onResend, resending }: { onRefresh: () => void; onResend: () => void; resending: boolean }) {
  return (
    <div className="mb-6 p-4 rounded-xl border border-[#FFECB3] bg-[#FFF9E6] dark:bg-amber-900/10 dark:border-amber-800/30">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-lg text-amber-700">
            <span className="material-symbols-outlined">mail</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm">Verifica tu correo</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Confirma tu cuenta para recibir notificaciones de tus regalos.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={onResend}
            disabled={resending}
            className="flex-1 md:flex-none px-4 py-2 text-xs font-bold text-amber-900 bg-amber-200 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 min-h-[36px]"
          >
            {resending ? 'Enviando...' : 'Reenviar'}
          </button>
          <button
            onClick={onRefresh}
            className="flex-1 md:flex-none px-4 py-2 text-xs font-bold text-gray-700 bg-white rounded-lg border border-amber-200 shadow-sm hover:bg-gray-50 transition-colors min-h-[36px]"
          >
            Ya lo verifiqué
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onClose, loading }: { message: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl text-center animate-zoom-in">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">warning</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">¿Estás seguro?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-white bg-red-500 hover:opacity-90 rounded-xl shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
            {loading ? '...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [events, setEvents] = useState<(Event & { giftCount?: number; photoCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ title: '', eventType: 'BABY_SHOWER' as EventType, hostPhone: '' });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadEvents();
  }, [isAuthenticated]);

  useEffect(() => {
    if (user && !user.emailVerified) setShowVerification(true);
  }, [user]);

  async function loadEvents() {
    try {
      const data = await apiClient.get<{ events: (Event & { giftCount?: number; photoCount?: number })[] }>('/api/events');
      setEvents(data.events || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al cargar eventos', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('El nombre del evento es obligatorio', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient.post<{ event: Event }>('/api/events', formData);
      setEvents((prev) => [res.event, ...prev]);
      setShowCreateModal(false);
      setFormData({ title: '', eventType: 'BABY_SHOWER', hostPhone: '' });
      showToast('Evento creado 🎉', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear evento', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm(null);
    setDeleting(id);
    try {
      await apiClient.del(`/api/events/${id}`);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      showToast('Evento eliminado', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`);
    showToast('Enlace copiado 📋', 'success');
  };

  const handleRefreshVerification = async () => {
    await refreshUser();
    if (user?.emailVerified) {
      setShowVerification(false);
      showToast('Correo verificado ✅', 'success');
    } else {
      showToast('Aún no verificas tu correo. Revisa tu bandeja de entrada.', 'error');
    }
  };

  const handleResendVerification = async () => {
    try {
      setResending(true);
      await apiClient.post('/api/auth/resend-verification');
      showToast('Correo reenviado 📬 Revisa tu bandeja de entrada', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al reenviar correo', 'error');
    } finally {
      setResending(false);
    }
  };

  const limits = TIER_LIMITS[user?.tier ?? 'free'];
  const eventCount = events.length;

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="flex gap-2">
                <div className="h-10 flex-1 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const dashboardContent = (
    <div>
      {showVerification && (
        <VerificationBanner
          onRefresh={handleRefreshVerification}
          onResend={handleResendVerification}
          resending={resending}
        />
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-outfit">Mis Eventos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {eventCount} evento{eventCount !== 1 ? 's' : ''} • {user?.tier === 'free' ? 'Plan Gratis' : 'Plan Pro'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all text-sm min-h-[44px]"
        >
          + Nuevo Evento
        </button>
      </div>

      {events.length === 0 ? (
        <section className="mt-8 text-center py-12 px-6 rounded-[40px] border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 font-outfit">🎉 ¿Qué evento quieres crear?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-3xl mx-auto">
            {ONBOARDING_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFormData({ ...formData, eventType: type });
                  setShowCreateModal(true);
                }}
                className="p-6 glass rounded-3xl flex flex-col items-center gap-3 hover:scale-105 transition-transform min-h-[120px]"
                aria-label={`Crear evento de ${EVENT_LABELS[type]}`}
              >
                <span className="text-4xl">{EVENT_ICONS[type]}</span>
                <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{EVENT_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const theme = THEME_COLORS[event.eventType];
                const total = event.giftCount || 0;
                const progress = limits.maxGiftsPerEvent > 0 ? Math.min((total / limits.maxGiftsPerEvent) * 100, 100) : 0;
                const fund = event.cashFund;
                const isBoosted = event.boostedUntil && new Date(event.boostedUntil) > new Date();

                return (
                  <div
                    key={event.id}
                    className="glass rounded-3xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow group relative"
                  >
                    <div className="h-2" style={{ background: theme.primary }} />
                    <div className="p-6 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-primary-fixed dark:bg-primary/20 rounded-2xl flex items-center justify-center text-2xl">
                          {EVENT_ICONS[event.eventType]}
                        </div>
                        {isBoosted && (
                          <span className="bg-primary/10 text-primary dark:text-primary-fixed-dim px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                            BOOST
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-900 dark:text-white mb-2 truncate">{event.title}</h3>

                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">{total} regalos{event.photoCount !== undefined ? ` · ${event.photoCount} fotos` : ''}</span>
                          <span className="font-bold" style={{ color: theme.primary }}>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, background: `linear-gradient(to right, ${theme.primary}, ${theme.dark})` }}
                          />
                        </div>

                        {fund ? (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/30 dark:border-amber-800/20 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                              <span className="material-symbols-outlined text-sm">savings</span>
                              Recaudado: {formatCOP(fund.collectedAmount)}
                            </div>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">COP</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-400 opacity-60">
                            <span className="material-symbols-outlined text-sm">payments</span>
                            Sin fondo configurado
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <Link
                          to={`/event/${event.id}`}
                          className="flex-1 text-center px-3 py-2.5 min-h-[44px] text-sm font-bold text-white rounded-xl transition-all hover:opacity-90"
                          style={{ background: theme.primary }}
                          aria-label={`Administrar ${event.title}`}
                        >
                          Administrar
                        </Link>
                        <button
                          onClick={() => copyLink(event.slug)}
                          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center glass border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          aria-label={`Copiar enlace de ${event.title}`}
                        >
                          <span className="material-symbols-outlined text-sm">link</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(event.id)}
                          disabled={deleting === event.id}
                          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center glass border border-gray-200 dark:border-gray-700 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-50"
                          aria-label={`Eliminar ${event.title}`}
                        >
                          {deleting === event.id ? '...' : <span className="material-symbols-outlined text-sm">delete</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          message="¿Eliminar este evento? Los regalos y fotos también se eliminarán. Esta acción no se puede deshacer."
          onConfirm={() => handleDelete(deleteConfirm)}
          onClose={() => setDeleteConfirm(null)}
          loading={deleting === deleteConfirm}
        />
      )}

      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <CreateForm
            formData={formData}
            setFormData={setFormData}
            creating={creating}
            handleCreate={handleCreate}
          />
        </Modal>
      )}
    </div>
  );

  return dashboardContent;
}

function CreateForm({ formData, setFormData, creating, handleCreate }: {
  formData: { title: string; eventType: EventType; hostPhone: string };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; eventType: EventType; hostPhone: string }>>;
  creating: boolean;
  handleCreate: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <form className="space-y-6">
      <div>
        <label className="block text-sm font-bold mb-3">Tipo de evento</label>
        <div className="grid grid-cols-3 gap-3">
          {ONBOARDING_TYPES.slice(0, 3).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData({ ...formData, eventType: type })}
              className={cn(
                'flex flex-col items-center p-4 rounded-2xl border-2 transition-all',
                formData.eventType === type
                  ? 'border-primary bg-primary-fixed dark:bg-primary/10 text-primary'
                  : 'border-outline-variant hover:border-primary text-on-surface-variant dark:hover:border-primary',
              )}
            >
              <span className="text-2xl mb-1">{EVENT_ICONS[type]}</span>
              <span className="text-xs font-bold">{EVENT_LABELS[type]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          Nombre del evento
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder="Ej: Boda de María y Juan"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          Celular de contacto (Opcional)
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.hostPhone}
          onChange={(e) => setFormData({ ...formData, hostPhone: e.target.value })}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder="+57 300 000 0000"
        />
      </div>

      <button
        type="submit"
        disabled={creating || !formData.title.trim()}
        onClick={handleCreate}
        className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center min-h-[52px]"
      >
        {creating ? <LoadingSpinner size="sm" /> : 'Crear Evento'}
      </button>
    </form>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-t-[32px] sm:rounded-3xl p-8 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-6 sm:hidden" />
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-outfit">Crear nuevo evento</h2>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

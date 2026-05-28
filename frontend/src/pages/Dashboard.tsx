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
    <div className="mb-6 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <span className="text-2xl">📧</span>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">Verifica tu correo electrónico</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Revisa tu bandeja de entrada para activar todas las funciones de tu cuenta.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onResend}
            disabled={resending}
            className="px-4 py-2 text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all disabled:opacity-50 min-h-[36px]"
          >
            {resending ? 'Enviando...' : 'Reenviar'}
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-all min-h-[36px]"
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-sm bg-white dark:bg-gray-800 p-6 rounded-t-2xl sm:rounded-2xl animate-slide-up shadow-xl">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded-xl hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-fuchsia-500 rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
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

  if (!user?.emailVerified && !showVerification) {
    // Don't show dashboard content if not verified
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
          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all text-sm min-h-[44px]"
        >
          + Nuevo Evento
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl mb-6 block">🎉</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 font-outfit">¿Qué evento quieres crear?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Elige el tipo de evento y empieza a armar tu lista de regalos en segundos.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-2xl mx-auto">
            {ONBOARDING_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFormData({ ...formData, eventType: type });
                  setShowCreateModal(true);
                }}
                className="flex flex-col items-center gap-2 p-5 backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 rounded-2xl hover:shadow-md transition-all hover:-translate-y-0.5 min-h-[100px]"
                aria-label={`Crear evento de ${EVENT_LABELS[type]}`}
              >
                <span className="text-3xl">{EVENT_ICONS[type]}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{EVENT_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>
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
                className="backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 rounded-2xl hover:shadow-md transition-all"
              >
                <div className="h-1.5 rounded-t-2xl" style={{ background: theme.primary }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl shrink-0">{EVENT_ICONS[event.eventType]}</span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{event.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{EVENT_LABELS[event.eventType]}</p>
                      </div>
                    </div>
                    {isBoosted && (
                      <span className="shrink-0 px-2 py-0.5 text-xs font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                        BOOST
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span>{total} regalos</span>
                    {event.photoCount !== undefined && <span>• {event.photoCount} fotos</span>}
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>{total}/{limits.maxGiftsPerEvent} regalos</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%`, background: theme.primary }}
                      />
                    </div>
                  </div>

                  {fund && (
                    <div className="mb-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          💰 {formatCOP(fund.collectedAmount)}
                        </span>
                        {fund.targetAmount && (
                          <span className="text-emerald-600 dark:text-emerald-500">
                            meta: {formatCOP(fund.targetAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-auto">
                    <Link
                      to={`/event/${event.id}`}
                      className="flex-1 text-center px-3 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-all"
                      style={{ background: theme.primary }}
                      aria-label={`Administrar ${event.title}`}
                    >
                      Administrar
                    </Link>
                    <button
                      onClick={() => copyLink(event.slug)}
                      className="px-3 py-2 min-h-[44px] text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      aria-label={`Copiar enlace de ${event.title}`}
                    >
                      <span aria-hidden="true">🔗</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(event.id)}
                      disabled={deleting === event.id}
                      className="px-3 py-2 min-h-[44px] text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                      aria-label={`Eliminar ${event.title}`}
                    >
                      {deleting === event.id ? '...' : <span aria-hidden="true">🗑️</span>}
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
            setShowCreateModal={setShowCreateModal}
            handleCreate={handleCreate}
          />
        </Modal>
      )}
    </div>
  );

  return dashboardContent;
}

function CreateForm({ formData, setFormData, creating, setShowCreateModal, handleCreate }: {
  formData: { title: string; eventType: EventType; hostPhone: string };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; eventType: EventType; hostPhone: string }>>;
  creating: boolean;
  setShowCreateModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleCreate: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <form onSubmit={handleCreate} className="space-y-5">
      <div className="flex flex-wrap gap-2 mb-4">
        {ONBOARDING_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFormData({ ...formData, eventType: type })}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-all',
              formData.eventType === type
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 ring-2 ring-rose-500'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200',
            )}
          >
            <span>{EVENT_ICONS[type]}</span>
            {EVENT_LABELS[type]}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Nombre del evento
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
          placeholder="Ej: Boda de María y Juan"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Teléfono (opcional)
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.hostPhone}
          onChange={(e) => setFormData({ ...formData, hostPhone: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
          placeholder="+52 555 123 4567"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setShowCreateModal(false)}
          className="flex-1 py-3 px-6 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={creating || !formData.title.trim()}
          className="flex-1 py-3 px-6 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center min-h-[44px]"
        >
          {creating ? <LoadingSpinner size="sm" /> : 'Crear Evento'}
        </button>
      </div>
    </form>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-t-2xl sm:rounded-b-2xl max-h-[90vh] overflow-y-auto animate-slide-up shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nuevo Evento</h2>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

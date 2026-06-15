import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { THEME_COLORS, EVENT_LABELS, EVENT_ICONS, TIER_LIMITS, type EventType, type Event } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCOP } from '../utils/format';
import { cn } from '../utils/cn';
import { ConfirmModal } from '../components/ConfirmModal';

const ONBOARDING_TYPES: EventType[] = ['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION', 'HOUSE_WARMING', 'OTHER'];

function useEventsQuery() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => apiClient.get<{ events: (Event & { giftCount?: number; photoCount?: number })[] }>('/api/events'),
    select: (data) => data.events || [],
    staleTime: 1000 * 60 * 2,
  });
}

export default function Dashboard() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading, refetch } = useEventsQuery();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ title: '', eventType: 'BABY_SHOWER' as EventType, hostPhone: '', eventDate: '', eventLocation: '', eventNote: '' });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
      refetch();
    }
  }, [isAuthenticated, refreshUser, refetch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('El nombre del evento es obligatorio', 'error');
      return;
    }
    setCreating(true);
    try {
      await apiClient.post<{ event: Event }>('/api/events', formData);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreateModal(false);
      setFormData({ title: '', eventType: 'BABY_SHOWER', hostPhone: '', eventDate: '', eventLocation: '', eventNote: '' });
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
      queryClient.invalidateQueries({ queryKey: ['events'] });
      showToast('Evento eliminado', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`);
      showToast('Enlace copiado ✅', 'success');
    } catch {
      showToast('No se pudo copiar el enlace', 'error');
    }
  };


  const limits = TIER_LIMITS[user?.tier ?? 'free'];
  const eventCount = events.length;

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-48 bg-surface-container-highest rounded-lg animate-pulse" />
          <div className="h-10 w-40 bg-surface-container-highest rounded-xl animate-pulse" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="backdrop-blur-md bg-white/70 border border-white/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container-highest animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-surface-container-highest rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-surface-container-highest rounded animate-pulse" />
                </div>
              </div>
              <div className="h-2 bg-surface-container-highest rounded-full animate-pulse" />
              <div className="flex gap-2">
                <div className="h-10 flex-1 bg-surface-container-highest rounded-lg animate-pulse" />
                <div className="h-10 w-10 bg-surface-container-highest rounded-lg animate-pulse" />
                <div className="h-10 w-10 bg-surface-container-highest rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const dashboardContent = (
    <div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-outfit">
            Mis Eventos <span className="text-on-surface-variant/70 font-normal">({eventCount})</span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Gestiona tus listas de regalos y fondos.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold shadow-lg shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all text-sm min-h-[44px] flex items-center justify-center gap-2 active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span className="hidden sm:inline">Nuevo Evento</span>
        </button>
      </div>

      {events.length === 0 ? (
        <section className="mt-8 text-center py-12 px-6 rounded-[40px] border-2 border-dashed border-outline-variant/30 bg-surface-container-lowest/50">
          <h2 className="text-2xl font-bold text-on-surface mb-8 font-outfit">🎉 ¿Qué evento quieres crear?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {ONBOARDING_TYPES.slice(0, 3).map((type) => (
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
                <span className="font-bold text-sm text-on-surface-variant">{EVENT_LABELS[type]}</span>
              </button>
            ))}
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-6 glass rounded-3xl flex flex-col items-center gap-3 hover:scale-105 transition-transform min-h-[120px]"
              aria-label="Crear otro tipo de evento"
            >
              <span className="text-4xl">➕</span>
              <span className="font-bold text-sm text-on-surface-variant">Otro</span>
            </button>
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
                        <div className="w-12 h-12 bg-primary-fixed rounded-2xl flex items-center justify-center text-2xl">
                          {EVENT_ICONS[event.eventType]}
                        </div>
                        {isBoosted && (
                          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                            BOOST
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-on-surface mb-2 truncate">{event.title}</h3>

                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                          <span className="text-on-surface-variant">{total} regalos{event.photoCount !== undefined ? ` · ${event.photoCount} fotos` : ''}</span>
                          <span className="font-bold" style={{ color: theme.primary }}>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, background: `linear-gradient(to right, ${theme.primary}, ${theme.dark})` }}
                          />
                        </div>

                        {fund ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/30 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-amber-600">
                              <span className="material-symbols-outlined text-sm">savings</span>
                              Recaudado: {formatCOP(fund.collectedAmount)}
                            </div>
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">COP</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm font-medium text-surface-variant opacity-60">
                            <span className="material-symbols-outlined text-sm">payments</span>
                            Sin fondo configurado
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-outline-variant/30">
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
                          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center glass border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors"
                          aria-label={`Copiar enlace de ${event.title}`}
                        >
                          <span className="material-symbols-outlined text-sm">link</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(event.id)}
                          disabled={deleting === event.id}
                          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center glass border border-outline-variant rounded-xl text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
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
  formData: { title: string; eventType: EventType; hostPhone: string; eventDate: string; eventLocation: string; eventNote: string };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; eventType: EventType; hostPhone: string; eventDate: string; eventLocation: string; eventNote: string }>>;
  creating: boolean;
  handleCreate: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <form className="space-y-6" onSubmit={handleCreate}>
      <div>
        <label className="block text-sm font-bold mb-3">Tipo de evento</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ONBOARDING_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData({ ...formData, eventType: type })}
              aria-pressed={formData.eventType === type}
              className={cn(
                'flex flex-col items-center p-4 rounded-2xl border-2 transition-all',
                formData.eventType === type
                  ? 'border-primary bg-primary-fixed text-primary'
                  : 'border-outline-variant hover:border-primary text-on-surface-variant',
              )}
            >
              <span className="text-2xl mb-1">{EVENT_ICONS[type]}</span>
              <span className="text-xs font-bold">{EVENT_LABELS[type]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-bold text-on-surface-variant mb-2">
          Nombre del evento
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder="Ej: Boda de María y Juan"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-bold text-on-surface-variant mb-2">
          Celular de contacto (Opcional)
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.hostPhone}
          onChange={(e) => setFormData({ ...formData, hostPhone: e.target.value })}
          className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder="+57 300 000 0000"
        />
      </div>

      <button
        type="submit"
        disabled={creating || !formData.title.trim()}
        className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center min-h-[52px]"
      >
        {creating ? <LoadingSpinner size="sm" /> : 'Crear Evento'}
      </button>

      <details className="text-sm text-on-surface-variant">
        <summary className="cursor-pointer font-medium">Más detalles (opcional)</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="eventDate" className="block text-sm font-bold text-on-surface-variant mb-2">
              Fecha del evento
            </label>
            <input
              id="eventDate"
              type="datetime-local"
              value={formData.eventDate}
              onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
              className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label htmlFor="eventLocation" className="block text-sm font-bold text-on-surface-variant mb-2">
              Lugar del evento
            </label>
            <input
              id="eventLocation"
              type="text"
              value={formData.eventLocation}
              onChange={(e) => setFormData({ ...formData, eventLocation: e.target.value })}
              className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Ej: Salón de eventos, Ciudad"
            />
          </div>
          <div>
            <label htmlFor="eventNote" className="block text-sm font-bold text-on-surface-variant mb-2">
              Nota para los invitados (Opcional)
            </label>
            <textarea
              id="eventNote"
              value={formData.eventNote}
              onChange={(e) => setFormData({ ...formData, eventNote: e.target.value })}
              className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              placeholder="Ej: No se aceptan regalos envueltos"
              rows={2}
            />
          </div>
        </div>
      </details>
    </form>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crear nuevo evento"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xl bg-surface rounded-t-[32px] sm:rounded-3xl p-8 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6 sm:hidden" />
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-on-surface font-outfit">Crear nuevo evento</h2>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-surface-variant hover:text-on-surface-variant rounded-full hover:bg-surface-container-high transition-colors"
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

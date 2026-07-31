import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { getCurrentSubscription } from '../services/mercadopago';
import { THEME_COLORS, EVENT_LABELS, EVENT_ICONS, TIER_LIMITS, type EventType, type Event, type Subscription } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatCOP } from '../utils/format';
import { reportError } from '../lib/reportError';
import { cn } from '../utils/cn';
import { completeWelcome } from '../services/onboarding';
import { ConfirmModal } from '../components/ConfirmModal';
import { WelcomeModal } from '../components/WelcomeModal';
import Sheet from '../components/ui/Sheet';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import SubscriptionBanners from '../components/dashboard/SubscriptionBanners';

const ONBOARDING_TYPES: EventType[] = ['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION', 'HOUSE_WARMING', 'OTHER'];

function useEventsQuery() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => apiClient.get<{ events: (Event & { giftCount?: number; photoCount?: number })[] }>('/api/events'),
    select: (data) => data.events || [],
    staleTime: 1000 * 60 * 2,
    retry: 2,
  });
}

export default function Dashboard() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading, isError: eventsError } = useEventsQuery();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ title: '', eventType: 'BABY_SHOWER' as EventType, hostPhone: '', eventDate: '', eventLocation: '', eventNote: '' });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const tierRef = useRef(user?.tier);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  useEffect(() => { tierRef.current = user?.tier; }, [user?.tier]);
  const [showPaymentBanner, setShowPaymentBanner] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);
  const [paymentRejected, setPaymentRejected] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (user && !user.welcomeTutorialCompleted) {
      setShowWelcome(true);
    }
  }, [user?.welcomeTutorialCompleted]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    setSubscriptionError(false);
    getCurrentSubscription()
      .then((res) => { if (mounted) setSubscription(res.subscription); })
      .catch((err) => { reportError(err, { source: 'Dashboard' }); if (mounted) setSubscriptionError(true); });
    return () => { mounted = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('pro')) return;

    const collectionStatus = params.get('collection_status');
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (collectionStatus === 'rejected') {
      setPaymentRejected(true);
      return;
    }

    setPollingPayment(true);

    const MAX_ATTEMPTS = 30;
    let attempts = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const poll = async () => {
      attempts++;
      try {
        await refreshUser();
        if (tierRef.current === 'pro' || tierRef.current === 'pro_plus') {
          setPollingPayment(false);
          showToast(`🎉 ¡Bienvenido a ${tierRef.current === 'pro_plus' ? 'Pro Plus' : 'Pro'}! Ahora tienes acceso a todas las funciones premium.`, 'success');
          queryClient.invalidateQueries({ queryKey: ['events'] });
          return;
        }
        if (attempts >= MAX_ATTEMPTS) {
          setPollingPayment(false);
          setShowPaymentBanner(true);
          return;
        }
      } catch (err) {
        reportError(err, { source: 'Dashboard' });
      }
      timeout = setTimeout(poll, 2000);
    };

    timeout = setTimeout(poll, 2000);

    return () => clearTimeout(timeout);
  }, [location.search, refreshUser, queryClient]);

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  const handleCompleteWelcome = useCallback(async () => {
    try {
      await completeWelcome();
      await refreshUser();
    } catch (err) {
      reportError(err, { source: 'Dashboard-welcome' });
    }
    setShowWelcome(false);
  }, [refreshUser]);

  const handleCreateFromWelcome = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowFab(window.scrollY > 250);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('create')) return;

    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    const maxEvents = TIER_LIMITS[user?.tier ?? 'free'].maxEvents;
    if (events.length >= maxEvents) {
      navigate('/pricing');
    } else {
      setShowCreateModal(true);
    }
  }, [location.search, events, user?.tier, navigate]);

  const handlePaymentSync = async () => {
    setSyncingPayment(true);
    try {
      const res = await apiClient.post<{ tier: string; synced: boolean; message: string }>('/api/subscriptions/sync');
      if (res.synced || res.tier === 'pro' || res.tier === 'pro_plus') {
        await refreshUser();
        showToast(res.message || '¡Suscripción activada!', 'success');
        setShowPaymentBanner(false);
        queryClient.invalidateQueries({ queryKey: ['events'] });
      } else {
        showToast(res.message || 'No se encontró el pago. Si el problema persiste, contacta a soporte.', 'info');
      }
    } catch (err) {
      reportError(err, { source: 'Dashboard' });
      showToast(err instanceof Error ? err.message : 'Error al verificar el pago', 'error');
    } finally {
      setSyncingPayment(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!formData.title.trim()) {
      showToast('El nombre del evento es obligatorio', 'error');
      return;
    }
    setCreating(true);
    safetyTimerRef.current = setTimeout(() => {
      setCreating(false);
      showToast('La creación está tomando más de lo esperado. Intenta de nuevo.', 'error');
    }, 15000);
    try {
      const cleanedData = {
        title: formData.title.trim(),
        eventType: formData.eventType,
        hostPhone: formData.hostPhone || undefined,
        eventDate: formData.eventDate ? new Date(formData.eventDate).toISOString() : undefined,
        eventLocation: formData.eventLocation || undefined,
        eventNote: formData.eventNote || undefined,
      };
      const res = await apiClient.post<{ event: Event & { id: string } }>('/api/events', cleanedData);
      clearTimeout(safetyTimerRef.current!);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreateModal(false);
      setFormData({ title: '', eventType: 'BABY_SHOWER', hostPhone: '', eventDate: '', eventLocation: '', eventNote: '' });
      navigate(`/event/${res.event.id}`);
    } catch (err) {
      clearTimeout(safetyTimerRef.current!);
      reportError(err, { source: 'Dashboard' });
      showToast(err instanceof Error ? err.message : 'Error al crear el evento. Verifica los datos e intenta de nuevo.', 'error');
    } finally {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      submittingRef.current = false;
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
      reportError(err, { source: 'Dashboard' });
      showToast(err instanceof Error ? err.message : 'Error al eliminar el evento. Intenta de nuevo.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`);
      showToast('Enlace copiado ✅', 'success');
    } catch (err) {
      reportError(err, { source: 'Dashboard' });
      showToast('No se pudo copiar el enlace', 'error');
    }
  };


  const limits = TIER_LIMITS[user?.tier ?? 'free'];
  const eventCount = events.length;

  if (eventsError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="material-symbols-outlined text-6xl text-red-400 mb-4" aria-hidden="true">error_outline</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">No pudimos cargar tus eventos</h2>
        <p className="text-on-surface-variant mb-6 max-w-md">Revisa tu conexión e intenta de nuevo.</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
          className="px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold shadow-lg min-h-[44px]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-48 bg-surface-container-highest rounded-lg animate-pulse" />
          <div className="h-10 w-40 bg-surface-container-highest rounded-xl animate-pulse" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const dashboardContent = (
    <div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-outfit tracking-tight">
            Mis Eventos <span className="text-on-surface-variant/50 font-normal text-xl sm:text-2xl">({eventCount})</span>
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={user?.tier === 'free' ? 'neutral' : user?.tier === 'pro_plus' ? 'gold' : 'primary'} size="sm" icon={user?.tier === 'free' ? 'redeem' : 'auto_awesome'}>
              {user?.tier === 'free' ? 'Plan Gratis' : user?.tier === 'pro_plus' ? 'Pro Plus' : 'Plan Pro'}
            </Badge>
            <span className="text-sm text-on-surface-variant/70">
              Tus celebraciones, todas en un solo lugar.
            </span>
          </div>
        </div>
                {eventCount >= limits.maxEvents ? (
                  <Button
                    variant="gold"
                    onClick={() => navigate('/pricing')}
                    data-testid="upgrade-cta"
                    className="animate-pulse-cta"
                    leftIcon={<span className="material-symbols-outlined">auto_awesome</span>}
                  >
                    Desbloquear más eventos
                  </Button>
                ) : (
                <Button
                  variant="primary"
                  onClick={() => setShowCreateModal(true)}
                  data-testid="new-event-button"
                  aria-label="Crear nuevo evento"
                  leftIcon={<span className="material-symbols-outlined">add</span>}
                >
                  Nuevo Evento
                </Button>
                )}
      </div>

      <SubscriptionBanners
        pollingPayment={pollingPayment}
        paymentRejected={paymentRejected}
        showPaymentBanner={showPaymentBanner}
        subscriptionError={subscriptionError}
        syncingPayment={syncingPayment}
        subscription={subscription}
        onPaymentSync={handlePaymentSync}
      />

      {events.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {[
              { label: 'Eventos', value: events.length, icon: 'calendar_month', stat: 'events', subtitle: 'Total de celebraciones creadas' },
              { label: 'Regalos', value: events.reduce((s, e) => s + (e.giftCount || 0), 0), icon: 'card_giftcard', stat: 'gifts', subtitle: 'Artículos en tus listas' },
              { label: 'Recaudado', value: formatCOP(events.reduce((s, e) => s + (e.cashFund?.collectedAmount || 0), 0)), icon: 'savings', stat: 'raised', subtitle: 'Aportes por Lluvia de Sobres' },
            ].map((stat) => (
              <div key={stat.label} data-testid={`stat-${stat.stat}`} className="glass rounded-2xl p-5 md:p-6 flex items-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl text-primary">{stat.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold text-on-surface truncate">{stat.value}</p>
                <p className="text-xs text-on-surface-variant/70 mt-0.5 font-medium uppercase tracking-wide">{stat.label}</p>
                <p className="text-xs text-on-surface-variant/70 mt-0.5">{stat.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <section className="mt-8 text-center py-14 px-8 rounded-[40px] border border-outline-variant/20 bg-surface-container-lowest/40 shadow-sm">
          <div className="max-w-sm mx-auto mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-3xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
            </div>
            <h2 className="text-2xl font-bold text-on-surface font-outfit tracking-tight">¿Qué evento quieres crear?</h2>
            <p className="text-sm text-on-surface-variant/70 mt-2 leading-relaxed">Elige el tipo de evento y empieza a armar tu lista en segundos.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {ONBOARDING_TYPES.map((type) => (
              <button
                key={type}
                data-testid={`create-event-${type.toLowerCase()}`}
                onClick={() => {
                  setFormData({ ...formData, eventType: type });
                  setShowCreateModal(true);
                }}
                className="p-6 glass rounded-3xl flex flex-col items-center gap-3 hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 min-h-[130px] group"
                aria-label={`Crear lista de ${EVENT_LABELS[type]}`}
              >
                <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{EVENT_ICONS[type]}</span>
                <span className="font-bold text-sm text-on-surface-variant group-hover:text-primary transition-colors">{EVENT_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
            <SectionErrorBoundary sectionName="DashboardEventCards">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const theme = THEME_COLORS[event.eventType];
                const total = event.giftCount || 0;
                const progress = limits.maxGiftsPerEvent > 0 ? Math.min((total / limits.maxGiftsPerEvent) * 100, 100) : 0;
                const fund = event.cashFund;

                return (
                  <div
                    key={event.id}
                    data-testid={`event-card-${event.id}`}
                    className="glass rounded-3xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group relative hover:-translate-y-0.5"
                  >
                    <div className="h-2" style={{ background: theme.primary }} />
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-primary-fixed rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                          {EVENT_ICONS[event.eventType]}
                        </div>
                        {event.status === 'completed' && (
                          <Badge variant="neutral" size="sm" icon="check_circle">
                            FINALIZADO
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-on-surface mb-3 truncate tracking-tight">{event.title}</h3>

                      <div className="space-y-3 mb-5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-on-surface-variant/70 font-medium">{total} / {limits.maxGiftsPerEvent} regalos{event.photoCount !== undefined ? <span className="ml-2 pl-2 border-l border-outline-variant/20">{event.photoCount} fotos</span> : ''}</span>
                          <span className="font-bold text-sm" style={{ color: theme.primary }}>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progress}%`, background: `linear-gradient(to right, ${theme.primary}, ${theme.dark})` }}
                          />
                        </div>

                        {fund ? (
                          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-amber-50/50 border border-amber-200/30 flex items-center justify-between gap-2 shadow-sm">
                            <div className="flex items-center gap-2.5 text-sm font-bold text-amber-700 min-w-0 truncate">
                              <span className="material-symbols-outlined text-base shrink-0">savings</span>
                              <span className="truncate">{formatCOP(fund.collectedAmount)}</span>
                            </div>
                            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-md shrink-0">COP</span>
                          </div>
                        ) : (
                          <Link
                            to={`/event/${event.id}`}
                            className="flex items-center gap-2 text-sm font-medium text-primary/60 hover:text-primary transition-all group/link"
                          >
                            <span className="material-symbols-outlined text-base">add_circle</span>
                            <span>Activar Lluvia de Sobres</span>
                            <span className="material-symbols-outlined text-sm opacity-0 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all">arrow_forward</span>
                          </Link>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-outline-variant/20 mt-auto">
                        <Link
                          to={`/event/${event.id}`}
                          className="flex-1 text-center px-4 py-2.5 min-h-[44px] text-sm font-bold text-white rounded-xl transition-all hover:shadow-lg hover:opacity-90 active:scale-[0.98]"
                          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.dark})` }}
                          aria-label={`Administrar ${event.title}`}
                        >
                          Administrar
                        </Link>
                        <button
                          onClick={() => copyLink(event.slug)}
                          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center glass border border-outline-variant/30 rounded-xl text-on-surface-variant hover:bg-primary-fixed hover:text-primary transition-all duration-200"
                          aria-label={`Copiar enlace de ${event.title}`}
                        >
                          <span className="material-symbols-outlined text-base">link</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(event.id)}
                          disabled={deleting === event.id}
                          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center glass border border-outline-variant/30 rounded-xl text-red-300 hover:bg-red-50 hover:text-red-500 transition-all duration-200 disabled:opacity-50"
                          aria-label={`Eliminar ${event.title}`}
                        >
                          {deleting === event.id ? <span className="block w-4 h-4 rounded-full border-2 border-red-300 border-t-transparent animate-spin" /> : <span className="material-symbols-outlined text-base">delete</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </SectionErrorBoundary>
      )}

      <AnimatePresence>
        {deleteConfirm && (
          <ConfirmModal
            key="delete"
            message="¿Eliminar este evento? Los regalos y fotos también se eliminarán. Esta acción no se puede deshacer."
            onConfirm={() => handleDelete(deleteConfirm)}
            onClose={() => setDeleteConfirm(null)}
            loading={deleting === deleteConfirm}
          />
        )}
      </AnimatePresence>

      <Sheet
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setFormData({ title: '', eventType: 'BABY_SHOWER', hostPhone: '', eventDate: '', eventLocation: '', eventNote: '' }); }}
        ariaLabel="Crear nuevo evento"
        className="p-8 pb-safe-lg"
      >
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-on-surface font-outfit">Crear nuevo evento</h2>
          <button
            onClick={() => { setShowCreateModal(false); setFormData({ title: '', eventType: 'BABY_SHOWER', hostPhone: '', eventDate: '', eventLocation: '', eventNote: '' }); }}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-surface-variant hover:text-on-surface-variant rounded-full hover:bg-surface-container-high transition-colors"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <CreateForm
          formData={formData}
          setFormData={setFormData}
          creating={creating}
          handleCreate={handleCreate}
        />
      </Sheet>

      <AnimatePresence>
        {showFab && eventCount < limits.maxEvents && (
          <motion.button
            initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 20, stiffness: 300 }}
            onClick={() => setShowCreateModal(true)}
            disabled={showCreateModal}
            aria-label="Crear nuevo evento"
            className="sm:hidden fixed bottom-24 right-5 z-[60] w-14 h-14 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full shadow-xl shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
          </motion.button>
        )}
      </AnimatePresence>

      <WelcomeModal
        open={showWelcome}
        hasEvents={events.length > 0}
        onCreateEvent={handleCreateFromWelcome}
        onClose={handleCompleteWelcome}
      />
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
  const [titleError, setTitleError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const validateTitle = (value: string) => {
    if (value.length > 100) return 'El nombre no puede superar 100 caracteres';
    return '';
  };

  const validatePhone = (value: string) => {
    if (value && !/^(\+57)?[0-9]{7,10}$/.test(value.replace(/\s/g, ''))) return 'Ingresa un número válido en Colombia (+57 300 000 0000)';
    return '';
  };

  const handleTitleChange = (value: string) => {
    if (value.length <= 100) {
      setFormData({ ...formData, title: value });
      setTitleError(validateTitle(value));
    }
  };

  const handlePhoneChange = (value: string) => {
    setFormData({ ...formData, hostPhone: value });
    setPhoneError(validatePhone(value));
  };

  return (
    <form className="space-y-6" onSubmit={(e) => {
      const tErr = validateTitle(formData.title);
      const pErr = validatePhone(formData.hostPhone);
      setTitleError(tErr);
      setPhoneError(pErr);
      if (tErr || pErr || !formData.title.trim()) { e.preventDefault(); return; }
      handleCreate(e);
    }}> 
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
          Nombre del evento <span className="text-xs text-on-surface-variant/50">{formData.title.length}/100</span>
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className={cn(
            'w-full rounded-xl border bg-surface text-on-surface px-4 py-3 outline-none focus:ring-2 transition-all',
            titleError ? 'border-error focus:border-error focus:ring-error/20' : 'border-outline-variant focus:border-primary focus:ring-primary/20',
          )}
          placeholder="Ej: Boda de María y Juan"
          autoComplete="off"
          autoFocus
          maxLength={100}
        />
        {titleError && <p className="text-xs text-error mt-1.5 font-medium">{titleError}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-bold text-on-surface-variant mb-2">
          Celular de contacto (Opcional)
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.hostPhone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className={cn(
            'w-full rounded-xl border bg-surface text-on-surface px-4 py-3 outline-none focus:ring-2 transition-all',
            phoneError ? 'border-error focus:border-error focus:ring-error/20' : 'border-outline-variant focus:border-primary focus:ring-primary/20',
          )}
          placeholder="+57 300 000 0000"
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="next"
        />
        {phoneError && <p className="text-xs text-error mt-1.5 font-medium">{phoneError}</p>}
      </div>

      <button
        type="submit"
        disabled={creating || !formData.title.trim()}
        className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 btn-gpu disabled:opacity-50 flex items-center justify-center min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {creating ? <><LoadingSpinner size="sm" /><span className="ml-2">Creando...</span></> : 'Crear Lista de Regalos'}
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
              autoComplete="street-address"
              inputMode="text"
              enterKeyHint="next"
              className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
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

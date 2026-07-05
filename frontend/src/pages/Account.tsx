import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentSubscription, getPaymentHistory } from '../services/mercadopago';
import { apiClient } from '../services/api';
import { TIER_LIMITS, type Subscription, type ProPayment } from '../types';
import { reportError } from '../lib/reportError';
import { showToast } from '../hooks/useToast';
import { formatDate, formatCOP, validateRedirectUrl } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import { AchievementsStrip } from '../components/AchievementsStrip';
import { useAchievements } from '../hooks/useAchievements';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import { cn } from '../utils/cn';

const AVATAR_MAP: Record<string, string> = {
  'avatar-1.png': '/illustrations/avatar-1.png',
  'avatar-2.png': '/illustrations/avatar-2.png',
  'avatar-3.png': '/illustrations/avatar-3.png',
  'avatar-4.png': '/illustrations/avatar-4.png',
  'avatar-5.png': '/illustrations/avatar-5.png',
};

function getUserAvatar(email: string): string {
  const hash = email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const keys = Object.keys(AVATAR_MAP);
  return AVATAR_MAP[keys[hash % keys.length]];
}

export default function Account() {
  const { user, resendVerification, refreshUser, logout } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [subError, setSubError] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cancelPassword, setCancelPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [payments, setPayments] = useState<ProPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { containerRef, token: turnstileToken, ready: turnstileReady, error: turnstileError } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  useEffect(() => {
    return () => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;
    let mounted = true;
    Promise.all([
      getCurrentSubscription(signal)
        .then((res) => { if (mounted) setSubscription(res.subscription); })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          reportError(err, { source: 'Account' });
          const message = err instanceof Error ? err.message : 'Error al cargar suscripción';
          showToast(message, 'error');
          if (mounted) setSubError(true);
          if (import.meta.env.DEV) console.error('[Account] subscription error:', err);
        }),
      getPaymentHistory(signal)
        .then((res) => { if (mounted) setPayments(res.payments); })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          reportError(err, { source: 'Account' });
          if (mounted) setPaymentsError(true);
        }),
    ]).finally(() => {
      if (mounted) {
        setLoadingSub(false);
        setPaymentsLoading(false);
      }
    });
    return () => { abortController.abort(); mounted = false; };
  }, []);

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const res = await apiClient.post<{ message: string; mpWarning?: string }>('/api/subscriptions/cancel', {}, {
        headers: { 'x-password': cancelPassword },
      });
      showToast(res.message, 'success');
      if (res.mpWarning) {
        showToast(res.mpWarning, 'info');
      }
      setSubscription(prev => prev ? { ...prev, status: 'canceled' as const } : null);
      await refreshUser();
      setShowCancelConfirm(false);
      setCancelPassword('');
    } catch (err) {
      reportError(err, { source: 'Account' });
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('contrase') || msg.toLowerCase().includes('password')) {
        showToast('Contraseña incorrecta. Verifica e intenta de nuevo.', 'error');
      } else if (msg) {
        showToast(msg, 'error');
      } else {
        showToast('Error al cancelar suscripción', 'error');
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDownloadData = async () => {
    setDownloading(true);
    try {
      const res = await apiClient.get<{ data: Record<string, unknown> }>('/api/auth/arco/my-data');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mis-datos-fiestaylista-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Datos descargados correctamente', 'success');
    } catch (err) {
      reportError(err, { source: 'Account' });
      showToast(err instanceof Error ? err.message : 'Error al descargar datos', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await apiClient.post('/api/auth/arco/delete-account', {}, {
        headers: { 'x-password': deletePassword },
      });
      showToast('Cuenta eliminada permanentemente', 'success');
      setShowDeleteConfirm(false);
      setDeletePassword('');
      logout();
    } catch (err) {
      reportError(err, { source: 'Account' });
      showToast(err instanceof Error ? err.message : 'Error al eliminar cuenta', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  const { getEarned, allAchievements } = useAchievements();

  if (!user) return null;

  const limits = TIER_LIMITS[user.tier];
  const avatarSrc = getUserAvatar(user.email);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mb-6">Mi Cuenta</h1>

      <div className="rounded-2xl p-6 glass-card-premium mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-xl text-gold">emoji_events</span>
          <h2 className="text-sm font-bold text-on-surface tracking-wide">TUS LOGROS</h2>
          <span className="text-xs text-on-surface-variant ml-auto">{getEarned().size}/{allAchievements.length} desbloqueados</span>
        </div>
        <AchievementsStrip unlockedIds={getEarned()} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div className="rounded-2xl p-6 sm:p-8 glass-card-premium">
          <div className="flex items-center gap-4 mb-6">
            <img src={avatarSrc} alt="Avatar del usuario" loading="lazy" className="w-16 h-16 rounded-2xl object-cover bg-surface-container-high ring-2 ring-primary/20" />
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Información Personal</h2>
              <p className="text-sm text-on-surface-variant">Tus datos de cuenta</p>
            </div>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-on-surface-variant">Nombre</dt>
              <dd className="text-on-surface font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-on-surface-variant">Correo electrónico</dt>
              <dd className="text-on-surface font-medium">{user.email}</dd>
              {!user.emailVerified && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  No verificado —{' '}
                  <button onClick={resendVerification} className="underline font-medium hover:text-amber-700">
                    Reenviar verificación
                  </button>
                </p>
              )}
            </div>
            <div>
              <dt className="text-sm text-on-surface-variant">Miembro desde</dt>
              <dd className="text-on-surface font-medium">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl p-6 sm:p-8 glass-card-premium">
          <h2 className="text-lg font-semibold text-on-surface mb-6">Suscripción</h2>
          {loadingSub ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : subError ? (
            <div className="text-center py-8">
              <p className="text-sm text-on-surface-variant mb-3">No pudimos cargar tu suscripción.</p>
              <button onClick={() => { setLoadingSub(true); setSubError(false); getCurrentSubscription().then((res) => setSubscription(res.subscription)).catch((err) => { reportError(err, { source: 'Account' }); setSubError(true); }).finally(() => setLoadingSub(false)); }} className="text-primary font-semibold text-sm underline hover:no-underline">
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <span className="text-sm text-on-surface-variant">Plan actual</span>
                <p className="text-2xl font-bold text-on-surface">
                  {user.tier === 'free' ? 'Plan Gratis' : user.tier === 'pro_plus' ? 'Plan Pro Plus' : 'Plan Pro'}
                  <span className="ml-3 text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold align-middle">
                    {user.tier === 'free' ? 'FREE' : user.tier === 'pro_plus' ? 'PRO PLUS' : 'PRO'}
                  </span>
                </p>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Eventos</span>
                  <span className="text-on-surface font-medium">{limits.maxEvents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Regalos por evento</span>
                  <span className="text-on-surface font-medium">{limits.maxGiftsPerEvent}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Fotos por evento</span>
                  <span className="text-on-surface font-medium">{limits.maxPhotosPerEvent}</span>
                </div>
              </div>

              {user.tier === 'free' && (
                <Link
                  to="/pricing"
                  className="w-full block text-center py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-bold hover:shadow-lg transition-all mb-6"
                >
                  Mejorar a Pro
                </Link>
              )}
              {user.tier === 'pro' && (
                <Link
                  to="/pricing"
                  className="w-full block text-center py-3 bg-gradient-to-r from-secondary to-secondary-container text-on-secondary rounded-xl font-bold hover:shadow-lg transition-all mb-6"
                >
                  Mejorar a Pro Plus
                </Link>
              )}

              {subscription && (
                <div className="text-sm text-on-surface-variant mb-6">
                  <p>Estado: <span className="capitalize font-medium text-on-surface">
                    {subscription.status === 'active' ? 'Activo' :
                     subscription.status === 'past_due' ? 'Vencido' :
                     subscription.status === 'canceled' ? 'Cancelado' :
                     subscription.status === 'incomplete' ? 'Incompleto' :
                     subscription.status === 'trialing' ? 'Prueba' :
                     subscription.status === 'pending_approval' ? 'Pendiente de aprobación' :
                     subscription.status}
                  </span></p>
                  {subscription.currentPeriodEnd && (
                    <p>{subscription.status === 'canceled' ? 'Acceso Pro hasta' : 'Próxima factura'}: {formatDate(subscription.currentPeriodEnd)}</p>
                  )}
                </div>
              )}

              {subscription?.status === 'pending_approval' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_top</span>
                    <div>
                      <p className="text-sm font-medium text-blue-800">Suscripción pendiente de aprobación</p>
                      <p className="text-xs text-blue-700 mt-1">Estamos esperando la confirmación del pago por parte de Mercado Pago. Este proceso suele tomar unos minutos. Te notificaremos cuando tu suscripción esté activa.</p>
                    </div>
                  </div>
                </div>
              )}

              {subscription?.status === 'past_due' && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    <div>
                      <p className="text-sm font-medium text-amber-800">Pago vencido</p>
                      <p className="text-xs text-amber-700 mt-1">Tu suscripción Pro está temporalmente suspendida por falta de pago. Actualiza tu método de pago para recuperar el acceso.</p>
                      <button
                        disabled={retryingPayment}
                        onClick={async () => {
                          if (retryingPayment) return;
                          setRetryingPayment(true);

                          safetyTimerRef.current = setTimeout(() => {
                            setRetryingPayment(false);
                            showToast('El servicio está tardando más de lo esperado. Intenta de nuevo.', 'info');
                          }, 15000);

                          try {
                            let token = turnstileToken;
                            if (!token) {
                              if (!turnstileReady) {
                                showToast('Verificando que no eres un robot...', 'info');
                              }
                              token = await waitForTurnstile(() => turnstileTokenRef.current, 50);
                              if (!token && turnstileError) {
                                showToast(`Verificación de seguridad no disponible. ${turnstileError} Puedes continuar, pero si el problema persiste desactiva tu bloqueador de anuncios.`, 'info');
                              } else if (!token) {
                                showToast('Verificación de seguridad no disponible. Continuando...', 'info');
                              }
                            }

                            const successUrl = `${window.location.origin}/dashboard?pro=activated`;
                            const cancelUrl = `${window.location.origin}/account`;
                            const res = await apiClient.post<{ url: string }>('/api/subscriptions/create-checkout', {
                              tier: user?.tier ?? 'pro',
                              successUrl,
                              cancelUrl,
                              turnstileToken: token ?? undefined,
                            });
                            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
                            const redirectUrl = validateRedirectUrl(res.url);
                            if (!redirectUrl) {
                              showToast('Error al procesar la URL de pago', 'error');
                              setRetryingPayment(false);
                              return;
                            }
                            window.location.href = redirectUrl;
                          } catch (err) {
                            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
                            reportError(err, { source: 'Account' });
                            showToast('Error al iniciar el proceso de pago', 'error');
                            setRetryingPayment(false);
                          }
                        }}
                        className={cn(
                          'mt-3 px-4 py-3 rounded-xl font-label-md text-label-md min-h-[44px]',
                          'inline-flex items-center justify-center gap-2',
                          'bg-secondary-container text-on-secondary-container',
                          'hover:brightness-110 active:scale-95 transition-all duration-200',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      >
                        {retryingPayment ? (
                          <><LoadingSpinner size="sm" /> Conectando...</>
                        ) : 'Reintentar pago'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {subscription?.status === 'canceled' && (() => {
                const daysSinceExpiry = subscription.currentPeriodEnd
                  ? Math.floor((Date.now() - new Date(subscription.currentPeriodEnd).getTime()) / (86400000))
                  : 0;

                // Still within grace period (less than 7 days since expiry)
                if (user.tier !== 'free' && daysSinceExpiry <= 7) {
                  return (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                        <div>
                          <p className="text-sm font-medium text-blue-800">Suscripción cancelada</p>
                          <p className="text-xs text-blue-700 mt-1">Tu suscripción ha sido cancelada, pero seguirás teniendo acceso a todas las funciones Pro hasta el final del período actual.</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Frozen (more than 7 days since expiry, tier is free)
                if (daysSinceExpiry > 7) {
                  const daysUntilPurge = 37 - daysSinceExpiry;
                  if (daysUntilPurge > 0) {
                    return (
                      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5">ac_unit</span>
                          <div>
                            <p className="text-sm font-medium text-blue-800">Eventos congelados</p>
                            <p className="text-xs text-blue-700 mt-1">Tus eventos ya no están visibles. Renueva tu suscripción para recuperar todos tus datos.</p>
                            {daysUntilPurge <= 7 && (
                              <p className="text-xs text-red-600 font-semibold mt-1">⚠️ Tus datos se eliminarán permanentemente en {daysUntilPurge} {daysUntilPurge === 1 ? 'día' : 'días'}.</p>
                            )}
                          </div>
                          <a href="/pricing" className="shrink-0 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-all min-h-[44px] flex items-center">
                            Ver planes
                          </a>
                        </div>
                      </div>
                    );
                  }

                  // Purged
                  return (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-red-600 text-sm mt-0.5">delete_forever</span>
                        <div>
                          <p className="text-sm font-medium text-red-800">Datos eliminados</p>
                          <p className="text-xs text-red-700 mt-1">Tus datos han sido eliminados por expiración de la suscripción. Puedes crear nuevos eventos desde cero.</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {subscription?.status === 'active' && (
                <>
                <button
                  data-testid="cancel-subscription-button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelLoading}
                  className="w-full py-3 bg-surface-container-high text-on-surface rounded-xl font-semibold hover:bg-surface-container-highest transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {cancelLoading ? <LoadingSpinner size="sm" /> : 'Cancelar Suscripción'}
                  </button>
                  <p className="text-xs text-on-surface-variant text-center mt-2">Al cancelar perderás acceso a las funciones premium al final del período actual.</p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {paymentsLoading ? (
        <div className="rounded-2xl p-6 sm:p-8 mb-8 glass-card-premium">
          <h2 className="text-lg font-semibold text-on-surface mb-4">Historial de Pagos</h2>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-surface-dim rounded" />
                  <div className="h-3 w-32 bg-surface-dim rounded" />
                </div>
                <div className="h-6 w-16 bg-surface-dim rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : paymentsError ? (
        <div className="rounded-2xl p-6 sm:p-8 mb-8 glass-card-premium">
          <h2 className="text-lg font-semibold text-on-surface mb-4">Historial de Pagos</h2>
          <p className="text-sm text-on-surface-variant">No pudimos cargar tu historial. Intenta de nuevo más tarde.</p>
        </div>
      ) : payments.length > 0 && (
        <div className="rounded-2xl p-6 sm:p-8 mb-8 glass-card-premium">
          <h2 className="text-lg font-semibold text-on-surface mb-4">Historial de Pagos</h2>
          <div className="space-y-3">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <div>
                  <p className="text-sm font-medium text-on-surface">{formatCOP(p.amount)}</p>
                  <p className="text-xs text-on-surface-variant">{p.interval === 'year' ? 'Plan Anual' : 'Plan Mensual'} · {formatDate(p.createdAt)}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  {p.status === 'completed' ? 'Pagado' : p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-6 sm:p-8 mb-8 glass-card-premium">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Mis Datos Personales</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          De acuerdo con la Ley 1581 de 2012, puedes ejercer tus derechos ARCO sobre tus datos personales.
        </p>
        <div className="flex flex-wrap gap-3">
            <button
              data-testid="download-data-button"
              onClick={handleDownloadData}
              disabled={downloading}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {downloading ? <span className="flex items-center gap-2"><span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Descargando...</span> : 'Descargar mis datos'}
            </button>
          <Link
            to="/derechos-arco"
            className="px-5 py-2.5 text-on-surface-variant bg-surface-container-high rounded-xl text-sm font-medium hover:bg-surface-container-highest transition-all"
          >
            Solicitar acceso, corrección o eliminación de datos
          </Link>
            <button
              data-testid="delete-account-button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 text-red-600 bg-red-50 rounded-xl text-sm font-medium hover:bg-red-100 transition-all"
            >
              Eliminar mi cuenta
            </button>
        </div>
      </div>

      {showCancelConfirm && (
        <div
          data-testid="cancel-subscription-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Cancelar suscripción"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowCancelConfirm(false); setCancelPassword(''); } }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCancelConfirm(false); setCancelPassword(''); } }}
        >
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-on-surface">Cancelar Suscripción</h3>
            <p className="text-sm text-on-surface-variant">Ingresa tu contraseña para confirmar la cancelación. Perderás acceso a funciones Pro al final del período actual.</p>
            <input
              id="cancel-password"
              type="password"
              value={cancelPassword}
              onChange={(e) => setCancelPassword(e.target.value)}
              placeholder="Tu contraseña"
              aria-label="Contraseña para cancelar suscripción"
              className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowCancelConfirm(false); setCancelPassword(''); }} className="flex-1 py-3 text-on-surface-variant font-medium rounded-xl bg-surface-container-high">
                Cancelar
              </button>
              <button onClick={handleCancelSubscription} disabled={!cancelPassword || cancelLoading} className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center">
                {cancelLoading ? <span className="flex items-center gap-2"><span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Cancelando...</span> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          data-testid="delete-account-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Eliminar cuenta"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); } }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); } }}
        >
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-red-600">Eliminar Cuenta</h3>
            <p className="text-sm text-on-surface-variant">Esta acción eliminará permanentemente tu cuenta, eventos y todos los datos asociados. No se puede deshacer.</p>
            <div>
              <label htmlFor="delete-confirm-text" className="block text-sm font-semibold text-on-surface mb-1">
                Escribe <span className="font-mono text-red-600">ELIMINAR MI CUENTA</span> para confirmar
              </label>
              <input
                id="delete-confirm-text"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR MI CUENTA"
                autoComplete="off"
                className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/50"
              />
            </div>
            <input
              id="delete-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Tu contraseña"
              aria-label="Contraseña para eliminar cuenta"
              className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/50"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); }} className="flex-1 py-3 text-on-surface-variant font-medium rounded-xl bg-surface-container-high">
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'ELIMINAR MI CUENTA' || !deletePassword || deletingAccount} className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center">
                {deletingAccount ? <span className="flex items-center gap-2"><span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Eliminando...</span> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div ref={containerRef} className="fixed bottom-0 right-0 z-50" />
    </div>
  );
}

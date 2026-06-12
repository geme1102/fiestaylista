import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentSubscription } from '../services/mercadopago';
import { apiClient } from '../services/api';
import { TIER_LIMITS, type Subscription } from '../types';
import { showToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    getCurrentSubscription()
      .then((res) => setSubscription(res.subscription))
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Error al cargar suscripción';
        showToast(message, 'error');
        if (import.meta.env.DEV) console.error('[Account] subscription error:', err);
      })
      .finally(() => setLoadingSub(false));
  }, []);

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      await apiClient.post('/api/subscriptions/cancel', { password: confirmPassword });
      showToast('Suscripción cancelada', 'success');
      setSubscription(null);
      setShowCancelConfirm(false);
      setConfirmPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al cancelar suscripción', 'error');
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
      showToast(err instanceof Error ? err.message : 'Error al descargar datos', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await apiClient.post('/api/auth/arco/delete-account', { password: confirmPassword });
      showToast('Cuenta eliminada permanentemente', 'success');
      setShowDeleteConfirm(false);
      setConfirmPassword('');
      setTimeout(() => { navigate('/'); }, 2000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar cuenta', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!user) return null;

  const limits = TIER_LIMITS[user.tier];
  const avatarSrc = getUserAvatar(user.email);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mb-8">Mi Cuenta</h1>

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
          ) : (
            <>
              <div className="mb-6">
                <span className="text-sm text-on-surface-variant">Plan actual</span>
                <p className="text-2xl font-bold text-on-surface capitalize">{user.tier}</p>
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
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Cash fund comisión</span>
                  <span className="text-on-surface font-medium">{limits.cashFundCommission}%</span>
                </div>
              </div>

              {subscription && (
                <div className="text-sm text-on-surface-variant mb-6">
                  <p>Estado: <span className="capitalize font-medium text-on-surface">{subscription.status === 'active' ? 'Activo' : subscription.status}</span></p>
                  {subscription.currentPeriodEnd && (
                    <p>Próxima factura: {formatDate(subscription.currentPeriodEnd)}</p>
                  )}
                </div>
              )}

              {subscription?.status === 'active' && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelLoading}
                  className="w-full py-3 bg-surface-container-high text-on-surface rounded-xl font-semibold hover:bg-surface-container-highest transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {cancelLoading ? <LoadingSpinner size="sm" /> : 'Cancelar Suscripción'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-6 sm:p-8 mb-8 glass-card-premium">
        <h2 className="text-lg font-semibold text-on-surface mb-4">🔐 Mis Datos Personales</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          De acuerdo con la Ley 1581 de 2012, puedes ejercer tus derechos ARCO sobre tus datos personales.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadData}
            disabled={downloading}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {downloading ? 'Descargando...' : 'Descargar mis datos'}
          </button>
          <Link
            to="/derechos-arco"
            className="px-5 py-2.5 text-on-surface-variant bg-surface-container-high rounded-xl text-sm font-medium hover:bg-surface-container-highest transition-all"
          >
            Gestionar solicitudes ARCO
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-5 py-2.5 text-red-600 bg-red-50 rounded-xl text-sm font-medium hover:bg-red-100 transition-all"
          >
            Eliminar mi cuenta
          </button>
        </div>
      </div>

      {showCancelConfirm && (
        <div role="dialog" aria-modal="true" aria-label="Cancelar suscripción" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-on-surface">Cancelar Suscripción</h3>
            <p className="text-sm text-on-surface-variant">Ingresa tu contraseña para confirmar la cancelación. Perderás acceso a funciones Pro al final del período actual.</p>
            <input
              id="cancel-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Tu contraseña"
              aria-label="Contraseña para cancelar suscripción"
              className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowCancelConfirm(false); setConfirmPassword(''); }} className="flex-1 py-3 text-on-surface-variant font-medium rounded-xl bg-surface-container-high">
                Cancelar
              </button>
              <button onClick={handleCancelSubscription} disabled={!confirmPassword || cancelLoading} className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50">
                {cancelLoading ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div role="dialog" aria-modal="true" aria-label="Eliminar cuenta" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-red-600">Eliminar Cuenta</h3>
            <p className="text-sm text-on-surface-variant">Esta acción eliminará permanentemente tu cuenta, eventos y todos los datos asociados. No se puede deshacer. Ingresa tu contraseña para confirmar.</p>
            <input
              id="delete-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Tu contraseña"
              aria-label="Contraseña para eliminar cuenta"
              className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/50"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setConfirmPassword(''); }} className="flex-1 py-3 text-on-surface-variant font-medium rounded-xl bg-surface-container-high">
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={!confirmPassword || deletingAccount} className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50">
                {deletingAccount ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

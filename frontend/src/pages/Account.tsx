import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentSubscription, cancelSubscription } from '../services/mercadopago';
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
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    getCurrentSubscription()
      .then((res) => setSubscription(res.subscription))
      .catch(() => {})
      .finally(() => setLoadingSub(false));
  }, []);

  const handleCancelSubscription = async () => {
    if (!window.confirm('¿Estás seguro de cancelar tu suscripción? Perderás acceso a funciones Pro al final del período actual.')) return;
    setCancelLoading(true);
    try {
      await cancelSubscription();
      showToast('Suscripción cancelada', 'success');
      setSubscription(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al cancelar suscripción', 'error');
      setCancelLoading(false);
    }
  };

  const handleDownloadData = async () => {
    try {
      const res = await apiClient.get<{ data: any }>('/api/auth/arco/my-data');
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
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('¿Estás seguro? Esta acción eliminará permanentemente tu cuenta, eventos, listas de regalos y todos los datos asociados. No se puede deshacer.')) return;
    try {
      await apiClient.del('/api/auth/arco/my-account');
      showToast('Cuenta eliminada permanentemente', 'success');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar cuenta', 'error');
    }
  };

  if (!user) return null;

  const limits = TIER_LIMITS[user.tier];
  const avatarSrc = getUserAvatar(user.email);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8">Mi Cuenta</h1>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div className="rounded-2xl p-6 sm:p-8 glass-card-premium">
          <div className="flex items-center gap-4 mb-6">
            <img src={avatarSrc} alt="Avatar del usuario" loading="lazy" className="w-16 h-16 rounded-2xl object-cover bg-gray-100 ring-2 ring-pink-200" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Información Personal</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tus datos de cuenta</p>
            </div>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Nombre</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Correo electrónico</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Miembro desde</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl p-6 sm:p-8 glass-card-premium">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Suscripción</h2>
          {loadingSub ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <div className="mb-6">
                <span className="text-sm text-gray-500 dark:text-gray-400">Plan actual</span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{user.tier}</p>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Eventos</span>
                  <span className="text-gray-900 dark:text-white font-medium">{limits.maxEvents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Regalos por evento</span>
                  <span className="text-gray-900 dark:text-white font-medium">{limits.maxGiftsPerEvent}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Fotos por evento</span>
                  <span className="text-gray-900 dark:text-white font-medium">{limits.maxPhotosPerEvent}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Cash fund comisión</span>
                  <span className="text-gray-900 dark:text-white font-medium">{limits.cashFundCommission}%</span>
                </div>
              </div>

              {subscription && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  <p>Estado: <span className="capitalize font-medium text-gray-900 dark:text-white">{subscription.status === 'active' ? 'Activo' : subscription.status}</span></p>
                  {subscription.currentPeriodEnd && (
                    <p>Próxima factura: {formatDate(subscription.currentPeriodEnd)}</p>
                  )}
                </div>
              )}

              {subscription?.status === 'active' && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {cancelLoading ? <LoadingSpinner size="sm" /> : 'Cancelar Suscripción'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-6 sm:p-8 mb-8 glass-card-premium">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🔐 Mis Datos Personales</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          De acuerdo con la Ley 1581 de 2012, puedes ejercer tus derechos ARCO sobre tus datos personales.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadData}
            className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
          >
            Descargar mis datos
          </button>
          <Link
            to="/derechos-arco"
            className="px-5 py-2.5 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          >
            Gestionar solicitudes ARCO
          </Link>
          <button
            onClick={handleDeleteAccount}
            className="px-5 py-2.5 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
          >
            Eliminar mi cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

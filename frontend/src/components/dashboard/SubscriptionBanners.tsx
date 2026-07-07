import { Link } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import type { Subscription } from '../../types';

interface SubscriptionBannersProps {
  pollingPayment: boolean;
  paymentRejected: boolean;
  showPaymentBanner: boolean;
  subscriptionError: boolean;
  syncingPayment: boolean;
  subscription: Subscription | null;
  onPaymentSync: () => void;
}

export default function SubscriptionBanners({
  pollingPayment, paymentRejected, showPaymentBanner, subscriptionError,
  syncingPayment, subscription, onPaymentSync,
}: SubscriptionBannersProps) {
  return (
    <>
      {pollingPayment && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50/90 border border-blue-200/60 flex items-start gap-3">
          <div className="w-5 h-5 mt-0.5 shrink-0 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-blue-800">Verificando tu pago</p>
            <p className="text-xs text-blue-700/70 mt-0.5">Estamos confirmando tu suscripción Pro con Mercado Pago. Esto toma unos segundos.</p>
          </div>
        </div>
      )}

      {paymentRejected && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50/90 border border-red-200/60 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">cancel</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-red-800">Pago rechazado</p>
            <p className="text-xs text-red-700/70 mt-0.5">El pago no fue procesado. Puedes intentar de nuevo desde la página de planes.</p>
          </div>
          <Link to="/pricing" className="shrink-0 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all min-h-[44px] flex items-center">
            Reintentar
          </Link>
        </div>
      )}

      {showPaymentBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/60 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">hourglass_top</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-amber-800">Verificando pago de Plan Pro</p>
            <p className="text-xs text-amber-700/70 mt-0.5">Tu pago fue procesado pero estamos esperando la confirmación. Si ya pagaste, presiona el botón para verificar.</p>
          </div>
          <button
            onClick={onPaymentSync}
            disabled={syncingPayment}
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 min-h-[44px] flex items-center gap-2"
          >
            {syncingPayment ? (
              <><LoadingSpinner size="sm" /> Verificando</>
            ) : (
              'Verificar pago'
            )}
          </button>
        </div>
      )}

      {subscription?.status === 'pending_approval' && !pollingPayment && !showPaymentBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50/90 border border-blue-200/60 flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-600 text-lg shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_top</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-blue-800">Suscripción pendiente</p>
            <p className="text-xs text-blue-700/70 mt-0.5">Estamos esperando la confirmación de Mercado Pago. Esto suele tomar unos minutos.</p>
          </div>
          <Link to="/account" className="shrink-0 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-all min-h-[44px] flex items-center">
            Ir a cuenta
          </Link>
        </div>
      )}

      {subscriptionError && !pollingPayment && !showPaymentBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50/90 border border-red-200/60 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">error</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-red-800">Error al cargar suscripción</p>
            <p className="text-xs text-red-700/70 mt-0.5">No pudimos verificar el estado de tu suscripción. Intenta recargar la página.</p>
          </div>
          <button onClick={() => window.location.reload()} className="shrink-0 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all min-h-[44px] flex items-center">
            Recargar
          </button>
        </div>
      )}

      {subscription?.status === 'past_due' && !pollingPayment && !showPaymentBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/60 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-amber-800">Pago pendiente</p>
            <p className="text-xs text-amber-700/70 mt-0.5">Tu suscripción Pro tiene un pago vencido. Actualiza tu método de pago para mantener el acceso a todas las funciones.</p>
          </div>
          <Link to="/account" className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all min-h-[44px] flex items-center">
            Ir a cuenta
          </Link>
        </div>
      )}

      {subscription?.status === 'canceled' && subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && !pollingPayment && !showPaymentBanner && (
        (() => {
          const daysSinceExpiry = Math.floor((Date.now() - new Date(subscription.currentPeriodEnd!).getTime()) / (86400000));
          const daysUntilPurge = 37 - daysSinceExpiry;
          return daysUntilPurge > 0 ? (
            <div className="mb-6 p-4 rounded-2xl bg-blue-50/90 border border-blue-200/60 flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 text-lg shrink-0 mt-0.5">ac_unit</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-blue-800">Eventos congelados</p>
                <p className="text-xs text-blue-700/70 mt-0.5">Tus eventos ya no son visibles para los invitados. Renueva tu suscripción para recuperarlos.</p>
                {daysUntilPurge <= 7 && (
                  <p className="text-xs text-red-600 font-semibold mt-1">⚠️ Tus datos se eliminarán permanentemente en {daysUntilPurge} {daysUntilPurge === 1 ? 'día' : 'días'}.</p>
                )}
              </div>
              <Link to="/pricing" className="shrink-0 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-all min-h-[44px] flex items-center">
                Ver planes
              </Link>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-2xl bg-red-50/90 border border-red-200/60 flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 text-lg shrink-0 mt-0.5">delete_forever</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-red-800">Datos eliminados</p>
                <p className="text-xs text-red-700/70 mt-0.5">Tu suscripción expiró y tus datos han sido eliminados. Puedes crear nuevos eventos desde cero.</p>
              </div>
              <Link to="/pricing" className="shrink-0 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-all min-h-[44px] flex items-center">
                Crear nuevo
              </Link>
            </div>
          );
        })()
      )}
    </>
  );
}

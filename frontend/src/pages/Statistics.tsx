import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { formatCOP } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Event } from '../types';

function useEventsWithViews(enabled: boolean) {
  return useQuery({
    queryKey: ['events-with-views'],
    enabled,
    queryFn: async () => {
      const eventsRes = await apiClient.get<{ events: (Event & { giftCount?: number; photoCount?: number })[] }>('/api/events');
      const events = eventsRes.events || [];
      const eventIds = events.map(e => e.id);
      let viewsMap: Record<string, number> = {};
      if (eventIds.length > 0) {
        try {
          const res = await apiClient.post<{ views: Record<string, number> }>('/api/analytics/views/batch', { eventIds });
          viewsMap = res.views;
        } catch {}
      }
      return events.map(event => ({ ...event, viewCount: viewsMap[event.id] ?? 0 }));
    },
    staleTime: 1000 * 60,
  });
}

export default function Statistics() {
  const { user } = useAuth();
  const isPro = user?.tier === 'pro';
  const { data: events = [], isLoading } = useEventsWithViews(isPro);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-2">Estadísticas exclusivas para Plan Pro</h2>
        <p className="text-sm text-on-surface-variant/70 mb-6 max-w-sm">
          Actualiza a Pro para acceder a gráficas, métricas y análisis detallados de tus eventos.
        </p>
        <Link
          to="/pricing"
          className="px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold shadow-lg shadow-primary/20 hover:shadow-xl transition-all text-sm"
        >
          Ver Planes
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const totalEvents = events.length;
  const totalGifts = events.reduce((s, e) => s + (e.giftCount || 0), 0);
  const totalViews = events.reduce((s, e) => s + (e.viewCount || 0), 0);
  const totalRaised = events.reduce((s, e) => s + (e.cashFund?.collectedAmount || 0), 0);
  const avgViewsPerEvent = totalEvents > 0 ? Math.round(totalViews / totalEvents) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-outfit tracking-tight">
          Estadísticas
        </h1>
        <p className="text-sm text-on-surface-variant/70 mt-1">
          Panel de análisis y métricas de tus eventos — {user?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass rounded-2xl p-5 md:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl text-primary">celebration</span>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-bold text-on-surface">{totalEvents}</p>
            <p className="text-xs text-on-surface-variant/70 mt-0.5 font-medium uppercase tracking-wide">Eventos</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 md:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl text-primary">card_giftcard</span>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-bold text-on-surface">{totalGifts}</p>
            <p className="text-xs text-on-surface-variant/70 mt-0.5 font-medium uppercase tracking-wide">Regalos</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 md:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl text-primary">visibility</span>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-bold text-on-surface">{totalViews}</p>
            <p className="text-xs text-on-surface-variant/70 mt-0.5 font-medium uppercase tracking-wide">Visitas totales</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 md:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl text-primary">savings</span>
          </div>
          <div className="min-w-0">
            <p className="text-xl md:text-2xl font-bold text-on-surface truncate">{formatCOP(totalRaised)}</p>
            <p className="text-xs text-on-surface-variant/70 mt-0.5 font-medium uppercase tracking-wide">Recaudado</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-on-surface mb-4">Resumen por evento</h2>
        <div className="space-y-4">
          {events.map((event) => {
            const giftPct = event.giftCount ? Math.min((event.giftCount / 50) * 100, 100) : 0;
            const viewPct = event.viewCount ? Math.min((event.viewCount / 100) * 100, 100) : 0;
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-on-surface text-sm truncate">{event.title}</h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                    {event.giftCount || 0} regalos
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                      <span>Visitas</span>
                      <span className="font-semibold">{event.viewCount || 0}</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${viewPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container"
                      />
                    </div>
                  </div>
                  {event.giftCount ? (
                    <div>
                      <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                        <span>Regalos</span>
                        <span className="font-semibold">{event.giftCount}</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${giftPct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                {event.cashFund?.collectedAmount ? (
                  <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-base text-secondary">savings</span>
                    <span className="font-semibold text-on-surface">{formatCOP(event.cashFund.collectedAmount)}</span>
                    <span className="text-on-surface-variant">recaudados</span>
                  </div>
                ) : null}
              </motion.div>
            );
          })}
          {events.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
              <p className="font-medium">No hay eventos para mostrar estadísticas</p>
              <p className="text-sm mt-1">Crea un evento desde el dashboard para ver sus métricas aquí.</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-bold text-on-surface mb-2">Métricas clave</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{avgViewsPerEvent}</p>
            <p className="text-xs text-on-surface-variant mt-1">Visitas promedio por evento</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalEvents > 0 ? (totalGifts / totalEvents).toFixed(1) : '0'}</p>
            <p className="text-xs text-on-surface-variant mt-1">Regalos promedio por evento</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalViews > 0 ? ((totalGifts / totalViews) * 100).toFixed(1) : '0'}%</p>
            <p className="text-xs text-on-surface-variant mt-1">Tasa de conversión (visita → regalo)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

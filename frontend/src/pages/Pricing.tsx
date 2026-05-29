import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession } from '../services/mercadopago';
import { showToast } from '../hooks/useToast';
import { cn } from '../utils/cn';
import NavbarPremium from '../components/NavbarPremium';

const PLANS = [
  {
    tier: 'free' as const,
    name: 'Gratis',
    price: 0,
    yearlyPrice: 0,
    popular: false,
    features: [
      { text: '1 evento', included: true },
      { text: '20 regalos por evento', included: true },
      { text: '5 fotos por evento', included: true },
      { text: 'Enlace público', included: true },
      { text: 'Cash fund (comisión 4%)', included: true },
      { text: 'Event Boost ($4.99/evento)', included: true },
      { text: 'Subida de fotos', included: false },
      { text: 'Estadísticas', included: false },
      { text: 'Sin marca de agua', included: false },
    ],
  },
  {
    tier: 'pro' as const,
    name: 'Pro',
    price: 24.99,
    yearlyPrice: 288.00,
    popular: true,
    badge: 'MÁS ELEGIDO',
    features: [
      { text: 'Hasta 20 eventos', included: true },
      { text: '500 regalos por evento', included: true },
      { text: '200 fotos por evento', included: true },
      { text: 'Cash fund (comisión 2%)', included: true },
      { text: 'Subida de fotos', included: true },
      { text: 'Estadísticas', included: true },
      { text: 'Event Boost incluido', included: true },
      { text: 'Sin marca de agua', included: true },
      { text: 'Soporte prioritario', included: true },
    ],
  },
];

function PricingCard({ plan, yearly, onSelect, userTier, loading }: {
  plan: typeof PLANS[0];
  yearly: boolean;
  onSelect: () => void;
  userTier?: string;
  loading: boolean;
}) {
  const price = yearly ? plan.yearlyPrice : plan.price;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl border-2 p-6 sm:p-8 transition-all duration-300',
        'bg-white dark:bg-gray-800',
        plan.popular
          ? 'border-rose-500 shadow-xl shadow-rose-500/10 scale-[1.02] sm:scale-105'
          : 'border-gray-200 dark:border-gray-700',
      )}
      role="article"
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-block px-4 py-1 text-xs font-bold tracking-wider text-white bg-gradient-to-r from-rose-500 to-fuchsia-500 rounded-full uppercase shadow-lg shadow-rose-500/25">
            {plan.badge}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-black text-gray-900 dark:text-white">${price}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {plan.price === 0 ? '' : yearly ? '/año' : '/mes'}
          </span>
        </div>
        {yearly && plan.price > 0 && (
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
            Ahorras ${(plan.price * 12 - plan.yearlyPrice).toFixed(2)} al año
          </p>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1" role="list">
        {plan.features.map((feat) => (
          <li key={feat.text} className="flex items-center gap-3 text-sm">
            <span className={cn(
              'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold',
              feat.included ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
            )}>
              {feat.included ? '✓' : '✕'}
            </span>
            <span className={feat.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>{feat.text}</span>
          </li>
        ))}
      </ul>

      {userTier === plan.tier ? (
        <div className="w-full py-3 text-center text-sm font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl border-2 border-rose-200 dark:border-rose-800">
          Plan Actual
        </div>
      ) : (
        <button
          onClick={onSelect}
          disabled={loading}
          className={cn(
            'w-full py-3 px-6 rounded-xl font-semibold transition-all disabled:opacity-50',
            plan.popular
              ? 'bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white hover:shadow-lg hover:shadow-rose-500/25'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600',
          )}
        >
          {loading ? 'Procesando...' : plan.price === 0 ? 'Empezar Gratis' : 'Actualizar a Pro'}
        </button>
      )}
    </div>
  );
}

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [showMobileHint, setShowMobileHint] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowMobileHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardWidth = container.querySelector('div')?.clientWidth ?? container.clientWidth;
    const gap = 16;
    const scrollPosition = container.scrollLeft;
    const totalCardWidth = cardWidth + gap;
    if (totalCardWidth <= 0) return;
    const idx = Math.round(scrollPosition / totalCardWidth);
    setScrollIndex(Math.min(idx, PLANS.length - 1));
  }, []);

  const handleSelect = async (tier: string) => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }
    if (tier === 'free') {
      navigate('/dashboard');
      return;
    }
    setSelectedTier(tier);
    setLoading(true);
    try {
      const interval = yearly ? 'year' : 'month';
      const res = await createCheckoutSession(tier as 'pro', undefined, undefined, interval);
      window.location.href = res.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear sesión de pago', 'error');
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Planes - Fiesta y Lista</title>
        <meta name="description" content="Elige el plan perfecto para tu evento. Desde gratis hasta Pro con beneficios exclusivos como Cash Fund sin comisiones." />
        <meta property="og:title" content="Planes - Fiesta y Lista" />
        <meta name="twitter:title" content="Planes - Fiesta y Lista" />
      </Helmet>
      <div className="min-h-screen bg-[#FAF9F8] dark:bg-[#0B0F19]">
        <NavbarPremium />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 rounded-full mb-4">
              Precios simples, sin sorpresas
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white mb-4 font-outfit">
              El plan perfecto para tu evento
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Empieza gratis y escala cuando lo necesites. Sin compromisos, cancelas cuando quieras.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-8 sm:mb-12">
            <span className={cn('text-sm font-medium', !yearly ? 'text-gray-900 dark:text-white' : 'text-gray-500')}>Mensual</span>
            <button
              onClick={() => setYearly(!yearly)}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors',
                yearly ? 'bg-rose-500' : 'bg-gray-300 dark:bg-gray-600',
              )}
              role="switch"
              aria-checked={yearly}
              aria-label="Alternar facturación anual"
            >
              <span className={cn(
                'absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform',
                yearly ? 'translate-x-7' : '',
              )} />
            </button>
            <span className={cn('text-sm font-medium', yearly ? 'text-gray-900 dark:text-white' : 'text-gray-500')}>
              Anual
              <span className="ml-1 text-xs text-green-600 dark:text-green-400 font-semibold">Ahorra 33%</span>
            </span>
          </div>

          <div className="hidden sm:grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <PricingCard
                key={plan.tier}
                plan={plan}
                yearly={yearly}
                onSelect={() => handleSelect(plan.tier)}
                userTier={user?.tier}
                loading={loading && selectedTier === plan.tier}
              />
            ))}
          </div>

          <div className="sm:hidden relative">
            {showMobileHint && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-gray-400 animate-fade-in whitespace-nowrap">
                ← Desliza para ver planes →
              </div>
            )}
            <div
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-4 px-4"
              onScroll={handleScroll}
            >
              {PLANS.map((plan) => (
                <div key={plan.tier} className="snap-center shrink-0 w-[85vw]">
                  <PricingCard
                    plan={plan}
                    yearly={yearly}
                    onSelect={() => handleSelect(plan.tier)}
                    userTier={user?.tier}
                    loading={loading && selectedTier === plan.tier}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2 mt-2">
              {PLANS.map((_, i) => (
                <button
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    scrollIndex === i ? 'bg-rose-500 w-4' : 'bg-gray-300 dark:bg-gray-600',
                  )}
                  onClick={() => {
                    const container = scrollContainerRef.current;
                    if (!container) return;
                    const card = container.children[i] as HTMLElement;
                    if (card) {
                      card.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                    }
                  }}
                  aria-label={`Ir al plan ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-12 sm:mt-16 max-w-3xl mx-auto">
            <div className="backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center font-outfit">
                ¿Necesitas más? Todas las listas incluyen:
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  '🎁 Lista de regalos ilimitada',
                  '📱 Vista optimizada para móvil',
                  '🔗 Enlace para compartir',
                  '📸 Galería de fotos',
                  '💬 Recordatorios por email',
                  '🛡️ Cancelación sin multa',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 sm:mt-16 max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center font-outfit">Preguntas Frecuentes</h3>
            <div className="space-y-3">
              {[
                { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Cancela tu suscripción en cualquier momento desde tu panel de control. Sin multas ni cargos adicionales.' },
                { q: '¿Qué es el Cash Fund / Lluvia de sobres?', a: 'Tus invitados pueden hacer aportaciones económicas directamente a tu evento. En el plan gratis la comisión es del 4%, en Pro del 2%.' },
                { q: '¿Qué es Event Boost?', a: 'Si estás en el plan gratis, puedes pagar $4.99 para activar el Cash Fund y estadísticas en un evento específico durante 30 días.' },
                { q: '¿Qué métodos de pago aceptan?', a: 'Aceptamos tarjetas de crédito y débito (Visa, Mastercard, American Express, etc.) a través de Mercado Pago. Los pagos son en pesos colombianos (COP).' },
                { q: '¿Cambiarán los precios después?', a: 'No. El precio que ves es el precio que pagas mientras mantengas tu suscripción activa.' },
              ].map((faq) => (
                <details key={faq.q} className="backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 rounded-2xl group">
                  <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                    {faq.q}
                    <span className="ml-2 text-rose-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-gray-600 dark:text-gray-400">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

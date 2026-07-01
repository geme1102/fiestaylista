import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession } from '../services/mercadopago';
import { showToast } from '../hooks/useToast';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import type { Tier } from '../types';
import { reportError } from '../lib/reportError';
import { cn } from '../utils/cn';
import { validateRedirectUrl } from '../utils/format';
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
      { text: '15 regalos por evento', included: true },
      { text: '3 fotos por evento', included: true },
      { text: 'Tus invitados te avisan por WhatsApp al apartar un regalo', included: true },
      { text: 'Lluvia de Sobres: tus invitados reportan sus aportes', included: true },
    ],
  },
  {
    tier: 'pro' as const,
    name: 'Pro',
    price: 59900,
    yearlyPrice: 660000,
    popular: true,
    badge: 'MÁS ELEGIDO',
    features: [
      { text: '1 evento', included: true },
      { text: '100 regalos por evento', included: true },
      { text: '20 fotos por evento', included: true },
      { text: 'Lluvia de Sobres: tus invitados reportan sus aportes', included: true },
      { text: 'Panel de estadísticas con gráficas', included: true },
      { text: 'Tus invitados te avisan por WhatsApp al apartar un regalo', included: true },
    ],
  },
  {
    tier: 'pro_plus' as const,
    name: 'Pro Plus',
    price: 99900,
    yearlyPrice: 1098900,
    popular: false,
    badge: 'NUEVO',
    features: [
      { text: '3 eventos', included: true },
      { text: '100 regalos por evento', included: true },
      { text: '20 fotos por evento', included: true },
      { text: 'Lluvia de Sobres: tus invitados reportan sus aportes', included: true },
      { text: 'Panel de estadísticas con gráficas', included: true },
      { text: 'Tus invitados te avisan por WhatsApp al apartar un regalo', included: true },
    ],
  },
];

const ALL_INCLUDED = [
  { icon: 'redeem', label: 'Listas de regalos online' },
  { icon: 'smartphone', label: 'Funciona en celular y computador' },
  { icon: 'link', label: 'Enlace para compartir por WhatsApp' },
  { icon: 'photo_library', label: 'Galería de fotos del evento' },
  { icon: 'notifications_active', label: 'Recordatorios a invitados' },
  { icon: 'verified_user', label: 'Cancelación en cualquier momento' },
];

const FAQS = [
  { q: '¿Cómo retiro el dinero que me den los invitados?', a: 'La Lluvia de Sobres funciona por transferencia directa: tus invitados envían su aporte a tu cuenta Nequi, Bancolombia o Daviplata. La app solo muestra cuánto han reportado. Tú recibes el dinero directamente.' },
  { q: '¿Cuántos regalos puedo agregar?', a: 'En el plan Gratis puedes agregar hasta 15 regalos por evento. En el plan Pro son hasta 100 regalos por evento. Ambos planes incluyen 1 evento.' },
  { q: '¿Puedo empezar gratis y luego actualizar?', a: 'Sí, empiezas sin pagar nada. Cuando quieras más regalos, actualizas a Pro y listo. Sin contratos ni permanencia.' },
  { q: '¿Es seguro para mis invitados?', a: 'Manejan su dinero directamente con su banco. Tus invitados transfieren a tu cuenta sin intermediarios.' },
];

export default function Pricing() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const { containerRef, token: turnstileToken, ready: turnstileReady, error: turnstileError } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'pending') {
      showToast('El pago está pendiente de confirmación. Te notificaremos cuando se complete.', 'info');
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [location.search]);

  const handleSelect = async (tier: string) => {
    if (authLoading) {
      showToast('Verificando sesión...', 'info');
      return;
    }
    if (!isAuthenticated) {
      navigate(`/register?plan=${tier}${yearly ? '&interval=year' : ''}`);
      return;
    }
    if (tier === 'free') {
      navigate('/dashboard');
      return;
    }
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
    setSelectedTier(tier);
    setLoading(true);

    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setSelectedTier(null);
      showToast('El servicio está tardando más de lo esperado. Intenta de nuevo.', 'info');
    }, 15000);

    try {
      const interval = yearly ? 'year' : 'month';
      const successUrl = `${window.location.origin}/dashboard?pro=activated`;
      const cancelUrl = `${window.location.origin}/pricing`;
      const res = await createCheckoutSession(tier as Tier, successUrl, cancelUrl, interval, token ?? undefined);
      clearTimeout(safetyTimer);
      const validatedUrl = validateRedirectUrl(res.url);
      if (validatedUrl) {
        window.location.href = validatedUrl;
      } else {
        showToast('URL de pago inválida', 'error');
        setLoading(false);
        setSelectedTier(null);
      }
    } catch (err) {
      clearTimeout(safetyTimer);
      reportError(err, { source: 'Pricing' });
      showToast(err instanceof Error ? err.message : 'Error al procesar el pago. Recarga la página e intenta de nuevo.', 'error');
      setLoading(false);
      setSelectedTier(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Planes - Fiesta y Lista</title>
        <meta name="description" content="Planes de Fiesta y Lista: gratis, Pro desde $59.900/mes y Pro Plus desde $99.900/mes con 3 eventos. Sin tarjeta de crédito para empezar." />
        <meta name="keywords" content="fiestaylista planes, lista de regalos precios, plan pro, plan pro plus, suscripción, lista de regalos Colombia" />
        <meta property="og:title" content="Planes - Fiesta y Lista" />
        <meta property="og:description" content="Planes de Fiesta y Lista: gratis, Pro y Pro Plus. Crea listas de regalos para baby showers, bodas y cumpleaños." />
        <meta name="twitter:title" content="Planes - Fiesta y Lista" />
        <meta name="twitter:description" content="Planes de Fiesta y Lista: gratis, Pro y Pro Plus." />
        <link rel="canonical" href="https://fiestaylista.com/pricing" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Fiesta y Lista",
            "description": "Planes de Fiesta y Lista con gratis, Pro y Pro Plus.",
            "url": "https://fiestaylista.com/pricing",
            "offers": [
              {
                "@type": "Offer",
                "name": "Plan Mensual Pro",
                "price": "59900",
                "priceCurrency": "COP",
                "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                "availability": "https://schema.org/InStock",
                "url": "https://fiestaylista.com/pricing"
              },
              {
                "@type": "Offer",
                "name": "Plan Anual Pro",
                "price": "660000",
                "priceCurrency": "COP",
                "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                "availability": "https://schema.org/InStock",
                "url": "https://fiestaylista.com/pricing"
              },
              {
                "@type": "Offer",
                "name": "Plan Mensual Pro Plus",
                "price": "99900",
                "priceCurrency": "COP",
                "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                "availability": "https://schema.org/InStock",
                "url": "https://fiestaylista.com/pricing"
              }
            ]
          })}
        </script>
      </Helmet>
      <div className="min-h-screen bg-surface">
        <NavbarPremium />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32">
          {/* Hero */}
          <section className="text-center mb-12 max-w-4xl mx-auto">
            <span className="inline-block bg-primary-fixed text-on-primary-fixed px-4 py-1 rounded-full font-label-md text-label-md mb-4">
              Planes
            </span>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-4">
              Elige el plan perfecto para tu celebración
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Empieza gratis, actualiza cuando lo necesites. Sin letra pequeña ni costos ocultos.
            </p>
          </section>

          {/* Social Proof */}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-12 text-center">
            <div>
              <p className="text-xl font-bold text-on-surface">+1,000</p>
              <p className="text-xs text-on-surface-variant">eventos creados</p>
            </div>
            <div>
              <p className="text-xl font-bold text-on-surface">+15,000</p>
              <p className="text-xs text-on-surface-variant">regalos apartados</p>
            </div>
            <div>
              <p className="text-xl font-bold text-on-surface">4.9</p>
              <p className="text-xs text-on-surface-variant">calificación</p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex flex-col items-center mb-12">
            <div className="bg-surface-container flex p-1 rounded-full relative mb-4">
              <button
                data-testid="pricing-toggle-monthly"
                onClick={() => setYearly(false)}
                className={cn(
                  'px-8 py-2 rounded-full font-label-md text-label-md transition-all duration-300 z-10',
                  !yearly ? 'text-on-surface' : 'text-on-surface-variant',
                )}
              >
                Mensual
              </button>
              <button
                data-testid="pricing-toggle-yearly"
                onClick={() => setYearly(true)}
                className={cn(
                  'px-8 py-2 rounded-full font-label-md text-label-md transition-all duration-300 z-10',
                  yearly ? 'text-on-surface' : 'text-on-surface-variant',
                )}
              >
                Anual
              </button>
              <div
                className="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-surface-container-lowest rounded-full shadow-sm transition-transform duration-300"
                style={{ transform: yearly ? 'translateX(100%)' : 'translateX(0)' }}
              />
            </div>
            {yearly && (
              <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-caption text-caption">
                Ahorra 8%
              </span>
            )}
          </div>

          {/* Turnstile (invisible) */}
          <div ref={containerRef} className="fixed bottom-0 right-0 z-50" />

          {/* Pricing Cards */}
          <section className="md:max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:grid md:grid-cols-3 gap-8 md:gap-6">
              {PLANS.map((plan) => {
                const price = yearly ? plan.yearlyPrice : plan.price;
                const isCurrent = user?.tier === plan.tier;

                return (
                  <div key={plan.tier} className={plan.popular ? 'relative' : ''}>
                    {plan.badge && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-6 py-1 rounded-full font-label-md text-label-md shadow-lg z-20 whitespace-nowrap">
                        {plan.badge}
                      </div>
                    )}
                    <div
                      className={cn(
                        'glass-card-gradient h-full p-8 rounded-3xl flex flex-col items-center text-center hover:-translate-y-2 hover:scale-[1.02] hover:shadow-xl transition-all duration-300',
                        plan.popular && 'glow-shadow-pro',
                      )}
                    >
                      <h3 className="font-headline-md text-headline-md mb-4 text-on-surface">
                        {plan.name}
                      </h3>
                      <div className="mb-6">
                        <span className="font-display-lg text-display-lg text-on-surface">
                          ${price.toLocaleString('es-CO')}
                        </span>
                        <span className="font-body-md text-body-md text-on-surface-variant">
                          {plan.price === 0 ? '' : yearly ? '/año' : '/mes'}
                        </span>
                      </div>
                      <ul className="space-y-4 mb-8 text-left w-full">
                        {plan.features.map((feat) => (
                          <li key={feat.text} className="flex items-center gap-3 font-body-md text-body-md">
                            <span className={cn(
                              'material-symbols-outlined text-xl',
                              feat.included ? 'text-primary' : 'text-on-surface-variant opacity-50',
                            )}
                              style={feat.included ? { fontVariationSettings: "'FILL' 1" } : {}}
                            >
                              {feat.included ? 'check_circle' : 'cancel'}
                            </span>
                            <span className={feat.included ? 'text-on-surface' : 'text-on-surface-variant opacity-50'}>
                              {feat.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div className="w-full py-4 text-center font-label-md text-label-md text-primary bg-primary/10 rounded-xl border-2 border-primary/20">
                          Plan Actual
                        </div>
                      ) : (
                        <button
                          data-testid={plan.price === 0 ? 'cta-free' : plan.tier === 'pro_plus' ? 'cta-pro-plus' : 'cta-pro'}
                          onClick={() => handleSelect(plan.tier)}
                          disabled={loading}
                          className={cn(
                            'mt-auto w-full py-4 font-label-md text-label-md rounded-xl active:scale-95 duration-200',
                            plan.popular
                              ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20'
                              : 'border-2 border-outline text-on-surface-variant hover:bg-surface-variant transition-colors',
                          )}
                        >
                          {loading && selectedTier === plan.tier
                            ? 'Procesando...'
                            : plan.price === 0
                              ? 'Empezar Gratis'
                              : plan.tier === 'pro_plus'
                                ? 'Actualizar a Pro Plus'
                                : 'Actualizar a Pro'
                          }
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Trust Signals */}
          <section className="max-w-3xl mx-auto px-4 mt-section-gap-mobile md:mt-section-gap-desktop text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                Pagos seguros con Mercado Pago
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-lg text-primary">account_balance</span>
                PSE · Nequi · Daviplata
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-lg text-primary">credit_card</span>
                Tarjeta crédito y débito
              </div>
            </div>
          </section>

          {/* Included Features */}
          <section className="max-w-5xl mx-auto px-4 mt-section-gap-mobile md:mt-section-gap-desktop text-center">
            <h2 className="font-headline-md text-headline-md mb-10 text-on-surface">Todas las listas incluyen</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {ALL_INCLUDED.map((item) => (
                <div key={item.label} className="glass-card p-6 rounded-2xl flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-secondary text-3xl">{item.icon}</span>
                  <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="max-w-3xl mx-auto px-4 mt-section-gap-mobile md:mt-section-gap-desktop">
            <h2 className="font-headline-md text-headline-md text-center mb-10 text-on-surface">Preguntas Frecuentes</h2>
            <div className="space-y-4" data-testid="faq-section">
              {FAQS.map((faq, idx) => (
                <div
                  key={idx}
                  data-testid="faq-item"
                  className={cn(
                    'glass-card rounded-2xl overflow-hidden cursor-pointer transition-all',
                    activeFaq === idx ? 'shadow-md' : '',
                  )}
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                >
                  <div className="p-6 flex justify-between items-center">
                    <span className="font-label-md text-label-md text-on-surface">{faq.q}</span>
                    <span className={cn(
                      'material-symbols-outlined text-on-surface-variant transition-transform duration-300',
                      activeFaq === idx ? 'rotate-180' : '',
                    )}>
                      expand_more
                    </span>
                  </div>
                  <div className={cn(
                    'overflow-hidden transition-all duration-300',
                    activeFaq === idx ? 'max-h-96' : 'max-h-0',
                  )}>
                    <div className="px-6 pb-6 font-body-md text-body-md text-on-surface-variant border-t border-outline-variant pt-4">
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Back link */}
          <div className="mt-12 text-center">
            <Link to="/" className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

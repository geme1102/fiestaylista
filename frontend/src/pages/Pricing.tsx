import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession } from '../services/mercadopago';
import { showToast } from '../hooks/useToast';
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
      { text: '2 eventos', included: true },
      { text: '10 regalos por evento', included: true },
      { text: '3 fotos por evento', included: true },
      { text: 'Lluvia de Sobres disponible', included: true },
      { text: '5% comisión al retirar dinero', included: true },
    ],
  },
  {
    tier: 'pro' as const,
    name: 'Pro',
    price: 24990,
    yearlyPrice: 288000,
    popular: true,
    badge: 'MÁS ELEGIDO',
    features: [
      { text: '20 eventos', included: true },
      { text: '50 regalos por evento', included: true },
      { text: '15 fotos por evento', included: true },
      { text: 'Lluvia de Sobres incluida sin costo extra', included: true },
      { text: '5% comisión al retirar dinero', included: true },
      { text: 'Notificaciones por WhatsApp en tiempo real', included: true },
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
  { q: '¿Cómo retiro el dinero que me den los invitados?', a: 'Solicitas el retiro desde tu panel y lo recibes en tu cuenta bancaria en Colombia. El proceso tarda de 24 a 48 horas hábiles.' },
  { q: '¿Cuántos regalos puedo agregar?', a: 'En el plan Gratis puedes agregar hasta 10 regalos por evento. En el plan Pro son hasta 50 regalos por evento. Si necesitas más, el Pro te da bastante espacio.' },
  { q: '¿Con qué pueden pagar mis invitados?', a: 'Tus invitados pueden pagar con tarjeta de crédito, PSE, Nequi o Daviplata. Todo a través de Mercado Pago, la plataforma más usada en Colombia.' },
  { q: '¿Puedo empezar gratis y luego actualizar?', a: 'Sí, empiezas sin pagar nada. Cuando quieras más eventos o regalos, actualizas a Pro y listo. Sin contratos ni permanencia.' },
  { q: '¿Es seguro para mis invitados?', a: 'Sí, usamos Mercado Pago con encriptación bancaria. Tus invitados pueden pagar tranquilos, sus datos están protegidos.' },
];

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

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
      const validatedUrl = validateRedirectUrl(res.url);
      if (validatedUrl) {
        window.location.href = validatedUrl;
      } else {
        showToast('URL de pago inválida', 'error');
        setLoading(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear sesión de pago', 'error');
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Planes - Fiesta y Lista</title>
        <meta name="description" content="Planes de Fiesta y Lista: plan gratis y Pro desde $24.990/mes. Sin tarjeta de crédito para empezar. Crea listas de regalos ilimitadas." />
        <meta name="keywords" content="fiestaylista planes, lista de regalos precios, plan pro, suscripción, lista de regalos Colombia" />
        <meta property="og:title" content="Planes - Fiesta y Lista" />
        <meta property="og:description" content="Planes de Fiesta y Lista: gratis y Pro desde $24.990/mes. Crea listas de regalos para baby showers, bodas y cumpleaños." />
        <meta name="twitter:title" content="Planes - Fiesta y Lista" />
        <meta name="twitter:description" content="Planes de Fiesta y Lista: gratis y Pro desde $24.990/mes." />
        <link rel="canonical" href="https://fiestaylista.com/pricing" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Fiesta y Lista Pro",
            "description": "Plan Pro de Fiesta y Lista con 20 eventos, 50 regalos por evento y Lluvia de Sobres incluida.",
            "url": "https://fiestaylista.com/pricing",
            "offers": [
              {
                "@type": "Offer",
                "name": "Plan Mensual Pro",
                "price": "24990",
                "priceCurrency": "COP",
                "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                "availability": "https://schema.org/InStock",
                "url": "https://fiestaylista.com/pricing"
              },
              {
                "@type": "Offer",
                "name": "Plan Anual Pro",
                "price": "288000",
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
              Precios
            </span>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-4">
              Elige el plan perfecto para tu celebración
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Empieza gratis, actualiza cuando lo necesites. Sin letra pequeña ni costos ocultos.
            </p>
          </section>

          {/* Toggle */}
          <div className="flex flex-col items-center mb-12">
            <div className="bg-surface-container flex p-1 rounded-full relative mb-4">
              <button
                onClick={() => setYearly(false)}
                className={cn(
                  'px-8 py-2 rounded-full font-label-md text-label-md transition-all duration-300 z-10',
                  !yearly ? 'text-on-surface' : 'text-on-surface-variant',
                )}
              >
                Mensual
              </button>
              <button
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
                Ahorra 33%
              </span>
            )}
          </div>

          {/* Pricing Cards */}
          <section className="md:max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-6">
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
                        'glass-card h-full p-8 rounded-3xl flex flex-col items-center text-center hover:-translate-y-2 hover:scale-[1.02] hover:shadow-xl transition-all duration-300',
                        plan.popular
                          ? 'border-2 border-primary/40 glow-shadow-pro'
                          : 'border border-outline-variant',
                      )}
                    >
                      <h3 className={cn(
                        'font-headline-md text-headline-md mb-4',
                        plan.popular ? 'text-primary' : 'text-on-surface-variant',
                      )}>
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
            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <div
                  key={idx}
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

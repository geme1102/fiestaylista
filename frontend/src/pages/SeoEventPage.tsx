import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import NavbarPremium from '../components/NavbarPremium';

const SEO_CONTENT: Record<string, { icon: string; title: string; subtitle: string; benefits: string[]; faq: { q: string; a: string }[] }> = {
  'baby-shower': {
    icon: '🍼',
    title: 'Lista de Regalos para Baby Shower',
    subtitle: 'Organiza los regalos para la llegada del bebé. Tus invitados pueden apartar regalos o contribuir económicamente.',
    benefits: [
      'Crea tu lista en 2 minutos, sin registro',
      'Los invitados apartan regalos sin duplicar',
      'Recibe aportaciones económicas con Lluvia de Sobres',
      'Galería de fotos para compartir momentos',
      'Recordatorios automáticos para invitados',
    ],
    faq: [
      { q: '¿Cómo crear una lista de baby shower?', a: 'Solo ponle nombre a tu evento, elige "Baby Shower" y empieza a agregar regalos. Puedes usar nuestras sugerencias o agregar los tuyos.' },
      { q: '¿Pueden los invitados aportar dinero?', a: 'Sí, con Lluvia de Sobres los invitados pueden hacer aportaciones económicas directas. La comisión es del 5% en el plan gratis.' },
      { q: '¿Es gratis?', a: 'Sí, el plan gratis incluye 2 eventos, 10 regalos y 3 fotos. Sin tarjeta de crédito.' },
    ],
  },
  boda: {
    icon: '💍',
    title: 'Lista de Regalos para Boda',
    subtitle: 'La lista de bodas perfecta para los novios. Tus invitados eligen y apartan regalos sin confusiones.',
    benefits: [
      'Lista de bodas online, fácil de compartir',
      'Los invitados ven los regalos disponibles en tiempo real',
      'Lluvia de Sobres: recibe aportaciones para la luna de miel',
      'Comparte por WhatsApp, Facebook o Twitter',
      'Estadísticas de quién ha visto y apartado regalos',
    ],
    faq: [
      { q: '¿Cómo funciona la lista de bodas?', a: 'Crean su evento, agregan los regalos que desean y comparten el enlace con los invitados. Cada invitado aparta lo que quiere regalar.' },
      { q: '¿Puedo recibir dinero en lugar de regalos?', a: 'Sí, con la función Lluvia de Sobres los invitados pueden contribuir económicamente para la luna de miel o lo que prefieran.' },
      { q: '¿Mis invitados necesitan registrarse?', a: 'No, los invitados solo necesitan el enlace para ver la lista y apartar regalos. No requieren cuenta.' },
    ],
  },
  cumpleanos: {
    icon: '🎂',
    title: 'Lista de Regalos para Cumpleaños',
    subtitle: 'Organiza los regalos de cumpleaños de forma fácil. Dile adiós a los regalos repetidos.',
    benefits: [
      'Evita regalos duplicados',
      'Los invitados apartan su regalo en segundos',
      'Sugerencias de regalos populares por edad',
      'Comparte el enlace por redes sociales',
      'Gratis para empezar',
    ],
    faq: [
      { q: '¿Cómo evitar regalos repetidos?', a: 'Cada invitado aparta el regalo que va a dar, así todos ven lo que ya está tomado.' },
      { q: '¿Puedo usarlo para el cumpleaños de mi hijo?', a: 'Sí, es perfecto para cumpleaños infantiles. Puedes agregar juguetes, ropa y más.' },
    ],
  },
  bautizo: {
    icon: '🕊️',
    title: 'Lista de Regalos para Bautizo',
    subtitle: 'Organiza los regalos para el bautizo de tu bebé. Fácil, rápido y sin complicaciones.',
    benefits: [
      'Lista personalizada para el evento',
      'Los padrinos y familiares apartan sus regalos',
      'Aportaciones económicas disponibles',
      'Comparte con todos los invitados',
      'Sin necesidad de registro para los invitados',
    ],
    faq: [
      { q: '¿Qué tipo de regalos puedo agregar?', a: 'Desde medallas y ropa de bautizo hasta aportaciones económicas. Tú decides.' },
      { q: '¿Los padrinos pueden aportar dinero?', a: 'Sí, con Lluvia de Sobres pueden hacer una contribución económica directa.' },
    ],
  },
  comunion: {
    icon: '✨',
    title: 'Lista de Regalos para Primera Comunión',
    subtitle: 'Organiza los regalos de comunión de forma sencilla. Tus invitados eligen sin repetir.',
    benefits: [
      'Crea tu lista en minutos',
      'Sugerencias de regalos para comunión',
      'Aportaciones económicas para el niño o niña',
      'Comparte el enlace con familiares y amigos',
      '100% gratis para empezar',
    ],
    faq: [
      { q: '¿Qué regalos son típicos para una comunión?', a: 'Relojes, cadenas, joyería, libros, mochilas y, por supuesto, aportaciones económicas.' },
      { q: '¿Puedo tener múltiples listas?', a: 'En el plan gratis tienes 2 eventos. Con Pro puedes tener hasta 20 eventos simultáneos.' },
    ],
  },
};

function SeoEventPage({ eventKey }: { eventKey: string }) {
  const content = SEO_CONTENT[eventKey];
  if (!content) return null;

  return (
    <>
      <Helmet>
        <title>{content.title}</title>
        <meta name="description" content={content.subtitle} />
        <meta name="keywords" content={`fiestaylista ${eventKey.replace('-', ' ')}, lista de regalos ${eventKey.replace('-', ' ')}, ${eventKey.replace('-', ' ')} Colombia`} />
        <meta property="og:title" content={content.title} />
        <meta property="og:description" content={content.subtitle} />
        <meta property="og:url" content={`https://fiestaylista.com/${eventKey}`} />
        <meta property="og:locale" content="es_CO" />
        <meta name="twitter:title" content={content.title} />
        <meta name="twitter:description" content={content.subtitle} />
        <link rel="canonical" href={`https://fiestaylista.com/${eventKey}`} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": content.title,
            "description": content.subtitle,
            "url": `https://fiestaylista.com/${eventKey}`,
            "inLanguage": "es-CO",
            "isPartOf": {
              "@type": "WebSite",
              "name": "Fiesta y Lista",
              "url": "https://fiestaylista.com"
            }
          })}
        </script>
      </Helmet>
      <div className="min-h-screen bg-[#FAF9F8]">
        <NavbarPremium />

        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-fixed to-primary-fixed/50 flex items-center justify-center text-4xl">
              {content.icon}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-on-surface mb-4 font-outfit">
              {content.title}
            </h1>
            <p className="text-lg sm:text-xl text-on-surface-variant max-w-2xl mx-auto">
              {content.subtitle}
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-primary/30 transition-all shadow-lg shadow-primary/20"
            >
              Crear mi lista gratis
              <span className="text-primary-fixed">→</span>
            </Link>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold text-on-surface mb-6 text-center font-outfit">Beneficios</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {content.benefits.map((b) => (
                <div key={b} className="flex items-center gap-3 p-4 backdrop-blur-md bg-white/70 border border-white/20 rounded-xl shadow-sm">
                  <span className="text-emerald-500 text-xl shrink-0">✓</span>
                  <span className="text-on-surface">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold text-on-surface mb-6 text-center font-outfit">Preguntas Frecuentes</h2>
            <div className="max-w-2xl mx-auto space-y-3">
              {content.faq.map((faq) => (
                <details key={faq.q} className="backdrop-blur-md bg-white/70 border border-white/20 rounded-2xl group">
                  <summary className="flex items-center justify-between p-4 cursor-pointer text-sm font-medium text-on-surface">
                    {faq.q}
                    <span className="ml-2 text-rose-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="px-4 pb-4 text-sm text-on-surface-variant">{faq.a}</div>
                </details>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link to="/pricing" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              Ver planes y precios →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default SeoEventPage;

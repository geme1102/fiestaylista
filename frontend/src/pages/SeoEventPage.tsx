import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import NavbarPremium from '../components/NavbarPremium';

const CTA_LABELS: Record<string, string> = {
  'baby-shower': 'Crear mi lista de baby shower',
  boda: 'Crear mi lista de bodas',
  cumpleanos: 'Crear mi lista de cumpleaños',
  bautizo: 'Crear mi lista de bautizo',
  comunion: 'Crear mi lista de comunión',
};

const SEO_CONTENT: Record<string, { icon: string; title: string; subtitle: string; benefits: string[]; faq: { q: string; a: string }[] }> = {
  'baby-shower': {
    icon: '🍼',
    title: 'Lista de Regalos para Baby Shower',
    subtitle: 'Organiza los regalos para la llegada del bebé. Tus invitados apartan lo que van a regalar, sin duplicar y sin registrarse.',
    benefits: [
      'Creas tu lista en 2 minutos, gratis y sin tarjeta de crédito',
      'Cada invitado aparta su regalo — nadie repite',
      'Recibe dinero directo con Lluvia de Sobres para lo que necesites',
      'Sube fotos del evento para que todos las vean',
      'Recordatorios automáticos a los que aún no han apartado',
    ],
    faq: [
      { q: '¿Cómo creo mi lista de baby shower?', a: 'Le pones nombre a tu evento, eliges "Baby Shower" y empiezas a agregar los regalos que quieres recibir. Puedes usar nuestras sugerencias o poner los tuyos. Todo en menos de 2 minutos.' },
      { q: '¿Los invitados pueden dar plata en vez de regalo?', a: 'Sí, con Lluvia de Sobres tus invitados te pueden hacer aportes en dinero directo. Tú decides si va para los pañales, la cuna o lo que más necesites.' },
      { q: '¿Esto es gratis de verdad?', a: 'Sí, el plan gratis incluye 1 evento, hasta 15 regalos por evento y 3 fotos. Sin tarjeta de crédito, sin compromiso.' },
    ],
  },
  boda: {
    icon: '💍',
    title: 'Lista de Regalos para Boda',
    subtitle: 'Organiza tu lista de bodas sin estrés. Tus invitados eligen, apartan y hasta te colaboran para la luna de miel — todo desde el celular.',
    benefits: [
      'Tu lista de bodas online, lista para compartir por WhatsApp',
      'Los invitados ven en tiempo real qué regalos están disponibles',
      'Lluvia de Sobres: recibe aportes para la luna de miel o la casa nueva',
      'Comparte el enlace por redes sociales o mensaje',
      'Ves quién ha visto la lista y quién ha apartado',
    ],
    faq: [
      { q: '¿Cómo funciona la lista de bodas?', a: 'Tú creas el evento, agregas los regalos que quieren recibir y compartes el enlace con los invitados. Cada invitado entra, ve lo disponible y aparta el suyo. Así nadie regala lo mismo.' },
      { q: '¿Podemos recibir plata en vez de regalos?', a: 'Sí, con Lluvia de Sobres tus invitados pueden hacer aportes en dinero directo a tu cuenta. Perfecto para la luna de miel, la cuota inicial o lo que sueñen.' },
      { q: '¿Los invitados necesitan descargar algo?', a: 'No, solo necesitan el enlace que les compartes.Entran, ven la lista, apartan su regalo y listo. Sin registro, sin descargar apps, sin complicaciones.' },
    ],
  },
  cumpleanos: {
    icon: '🎂',
    title: 'Lista de Regalos para Cumpleaños',
    subtitle: 'Olvídate de los regalos repetidos. Tus invitados ven lo que ya está apartado y eligen sin confundirse.',
    benefits: [
      'Nadie repite regalo — todos ven lo que ya está apartado',
      'Los invitados apartan en segundos desde su celular',
      'Sugerencias de regalos según la edad del cumpleañero',
      'Compartes el enlace por WhatsApp y listo',
      'Gratis para empezar, sin tarjeta de crédito',
    ],
    faq: [
      { q: '¿Cómo evito que me regalen lo mismo?', a: 'Cada invitado aparta el regalo que va a dar. Los demás ven que ya está tomado y eligen otro. Fin del problema.' },
      { q: '¿Sirve para cumpleaños de niños?', a: 'Claro, es ideal para cumpleaños infantiles. Agregas juguetes, ropa, libros o lo que prefieras. Los papás de los invitados lo entienden en segundos.' },
    ],
  },
  bautizo: {
    icon: '🕊️',
    title: 'Lista de Regalos para Bautizo',
    subtitle: 'Organiza los regalos del bautizo de tu bebé sin estrés. Los padrinos y familiares apartan su regalo desde el celular.',
    benefits: [
      'Lista personalizada para el bautizo, lista en minutos',
      'Los padrinos y familiares apartan sin registrarse',
      'Recibe aportes en dinero con Lluvia de Sobres',
      'Compartes el enlace por WhatsApp para llegar a todos',
      'Los invitados no necesitan crear cuenta ni descargar nada',
    ],
    faq: [
      { q: '¿Qué regalos puedo poner en la lista?', a: 'Lo que tú quieras: medallas, ropa de bautizo, joyas, juguetes, libros o aportes en dinero. Tú decides.' },
      { q: '¿Los padrinos pueden dar plata?', a: 'Sí, con Lluvia de Sobres pueden hacer un aporte directo desde su celular. Ideal si prefieren ayudar con los gastos del bautizo.' },
    ],
  },
  comunion: {
    icon: '✨',
    title: 'Lista de Regalos para Primera Comunión',
    subtitle: 'Organiza los regalos de primera comunión de forma fácil. Tus invitados eligen sin repetir y sin complicaciones.',
    benefits: [
      'Creas tu lista en minutos desde el celular',
      'Sugerencias de regalos típicos de comunión',
      'Recibe aportes en dinero con Lluvia de Sobres',
      'Compartes el enlace con toda la familia',
      '100% gratis para empezar, sin compromiso',
    ],
    faq: [
      { q: '¿Qué regalos puedo pedir para una comunión?', a: 'Reloj, cadena, joyería, libros, ropa, mochilas o aportes en dinero. Tú sabes lo que necesita el niño o niña.' },
      { q: '¿Puedo hacer más de una lista?', a: 'El plan gratis incluye 1 evento. Si necesitas más regalos, el plan Pro te da 100 regalos por evento.' },
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
        <meta name="keywords" content={`fiestaylista ${eventKey.replace(/-/g, ' ')}, lista de regalos ${eventKey.replace(/-/g, ' ')}, ${eventKey.replace(/-/g, ' ')} Colombia`} />
        <meta property="og:title" content={content.title} />
        <meta property="og:description" content={content.subtitle} />
        <meta property="og:url" content={`https://fiestaylista.com/${eventKey}`} />
        <meta property="og:locale" content="es_CO" />
        <meta name="twitter:title" content={content.title} />
        <meta name="twitter:description" content={content.subtitle} />
        <link rel="canonical" href={`${window.location.origin}/${eventKey}`} />
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
      <main className="min-h-screen bg-surface">
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
                {CTA_LABELS[eventKey] || 'Crear mi lista gratis'}
                <span className="text-primary-fixed">→</span>
              </Link>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold text-on-surface mb-6 text-center font-outfit">Beneficios</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {content.benefits.map((b) => (
                <div key={b} className="flex items-center gap-3 p-4 backdrop-blur-md bg-surface/70 border border-white/20 rounded-xl shadow-sm">
                  <span className="material-symbols-outlined text-emerald-500 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-on-surface">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold text-on-surface mb-6 text-center font-outfit">Preguntas Frecuentes</h2>
            <div className="max-w-2xl mx-auto space-y-3">
              {content.faq.map((faq) => (
                <details key={faq.q} className="backdrop-blur-md bg-surface/70 border border-white/20 rounded-2xl group">
                  <summary className="flex items-center justify-between p-4 cursor-pointer text-sm font-medium text-on-surface hover:bg-primary/5 rounded-2xl transition-colors">
                    {faq.q}
                    <span className="material-symbols-outlined ml-2 text-rose-500 group-open:rotate-180 transition-transform">expand_more</span>
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

          <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">account_balance</span> Transferencia directa al anfitrión</span>
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">how_to_reg</span> Registra tu aporte voluntariamente</span>
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">shield</span> Datos protegidos</span>
          </div>
        </div>
      </main>
    </>
  );
}

export default SeoEventPage;

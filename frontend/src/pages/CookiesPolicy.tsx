import { useState } from 'react';
import { Link } from 'react-router-dom';

type Lang = 'es' | 'en';

const ES = {
  title: 'Política de Cookies',
  subtitle: 'Última actualización: Mayo 2026',
  intro: 'En Fiesta y Lista, operada por Diego Alejandro Fierro Rivera, utilizamos cookies y tecnologías similares para garantizar el funcionamiento adecuado de nuestra plataforma y mejorar tu experiencia. Esta política explica qué son las cookies, cómo las usamos y cómo puedes controlarlas.',
  sections: [
    {
      title: '1. ¿Qué son las Cookies?',
      content: 'Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. Permiten que el sitio recuerde tus preferencias y acciones durante un período de tiempo, evitando tener que volver a introducir información cada vez que nos visitas.',
    },
    {
      title: '2. Tipos de Cookies que Utilizamos',
      content: '(a) Cookies Esenciales: necesarias para el funcionamiento básico de la plataforma, como la autenticación y seguridad. No requieren consentimiento. (b) Cookies Analíticas: nos ayudan a entender cómo los usuarios interactúan con la plataforma, qué secciones visitan y cómo podemos mejorar. (c) Cookies de Preferencias: recuerdan tus configuraciones como el idioma y el tema (oscuro/claro). (d) Cookies de Terceros: utilizadas por servicios integrados como Mercado Pago para procesar pagos.',
    },
    {
      title: '3. Base Legal',
      content: 'De acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013, las cookies esenciales no requieren consentimiento previo. Las cookies analíticas y de preferencias se activan solo con tu consentimiento explícito, que puedes otorgar o rechazar en nuestro banner de cookies inicial.',
    },
    {
      title: '4. Control de Cookies',
      content: 'Puedes gestionar tus preferencias de cookies en cualquier momento a través de nuestro banner de cookies. También puedes configurar tu navegador para bloquear o eliminar cookies. Sin embargo, deshabilitar cookies esenciales puede afectar el funcionamiento de la plataforma.',
    },
    {
      title: '5. Cookies Específicas',
      content: 'Utilizamos las siguientes cookies: refreshToken (esencial, persistente, para mantener tu sesión iniciada); theme (preferencia, persistente, almacena tu preferencia de tema oscuro/claro); consent_v1 (esencial, persistente, registra tu consentimiento de cookies).',
    },
    {
      title: '6. Terceros',
      content: 'Mercado Pago puede establecer cookies necesarias para procesar pagos de forma segura. No tenemos control sobre estas cookies. Consulta la política de privacidad de Mercado Pago para más información.',
    },
    {
      title: '7. Actualizaciones',
      content: 'Podemos actualizar esta política de cookies periódicamente. Te notificaremos cualquier cambio significativo a través de la plataforma.',
    },
  ],
  footer: '© {year} Diego Alejandro Fierro Rivera. Todos los derechos reservados.',
};

const EN = {
  title: 'Cookies Policy',
  subtitle: 'Last updated: May 2026',
  intro: 'At Fiesta y Lista, operated by Diego Alejandro Fierro Rivera, we use cookies and similar technologies to ensure the proper functioning of our platform and enhance your experience. This policy explains what cookies are, how we use them, and how you can control them.',
  sections: [
    {
      title: '1. What are Cookies?',
      content: 'Cookies are small text files stored on your device when you visit a website. They allow the site to remember your preferences and actions over time, avoiding the need to re-enter information each time you visit.',
    },
    {
      title: '2. Types of Cookies We Use',
      content: '(a) Essential Cookies: necessary for basic platform functionality, such as authentication and security. They do not require consent. (b) Analytical Cookies: help us understand how users interact with the platform, which sections they visit, and how we can improve. (c) Preference Cookies: remember your settings such as language and theme (dark/light). (d) Third-Party Cookies: used by integrated services such as Mercado Pago to process payments.',
    },
    {
      title: '3. Legal Basis',
      content: 'In accordance with Colombian Law 1581 of 2012 and Decree 1377 of 2013, essential cookies do not require prior consent. Analytical and preference cookies are activated only with your explicit consent, which you can grant or reject in our initial cookie banner.',
    },
    {
      title: '4. Cookie Control',
      content: 'You can manage your cookie preferences at any time through our cookie banner. You can also configure your browser to block or delete cookies. However, disabling essential cookies may affect platform functionality.',
    },
    {
      title: '5. Specific Cookies',
      content: 'We use the following cookies: refreshToken (essential, persistent, to keep your session logged in); theme (preference, persistent, stores your dark/light theme preference); consent_v1 (essential, persistent, records your cookie consent).',
    },
    {
      title: '6. Third Parties',
      content: 'Mercado Pago may set cookies necessary to securely process payments. We have no control over these cookies. See Mercado Pago\'s privacy policy for more information.',
    },
    {
      title: '7. Updates',
      content: 'We may update this cookies policy periodically. We will notify you of any significant changes through the platform.',
    },
  ],
  footer: '© {year} Diego Alejandro Fierro Rivera. All rights reserved.',
};

export default function CookiesPolicy() {
  const [lang, setLang] = useState<Lang>('es');
  const content = lang === 'es' ? ES : EN;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-fixed/10 via-surface to-surface dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-primary hover:text-primary-fixed-dim dark:text-primary-fixed-dim text-sm font-medium">
              ← Volver / Back
            </Link>
            <h1 className="text-3xl font-bold text-on-surface dark:text-inverse-on-surface mt-2">{content.title}</h1>
            <p className="text-sm text-on-surface-variant dark:text-surface-variant mt-1">{content.subtitle}</p>
          </div>
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant dark:text-inverse-on-surface bg-surface dark:bg-inverse-surface border border-outline-variant rounded-xl hover:bg-surface-container-low dark:hover:bg-inverse-surface transition-colors"
          >
            {lang === 'es' ? 'English' : 'Español'}
          </button>
        </div>

        <div className="rounded-2xl p-8 sm:p-10 glass-card-premium">
          <p className="text-on-surface-variant dark:text-surface-variant mb-8">{content.intro}</p>

          <div className="space-y-8">
            {content.sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-xl font-semibold text-on-surface dark:text-inverse-on-surface mb-3">{section.title}</h2>
                <p className="text-on-surface-variant dark:text-surface-variant leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-outline-variant">
            <p className="text-sm text-on-surface-variant dark:text-surface-variant">
              {content.footer.replace('{year}', String(new Date().getFullYear()))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

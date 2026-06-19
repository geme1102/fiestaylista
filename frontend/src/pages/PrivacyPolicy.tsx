import { useState } from 'react';
import { Link } from 'react-router-dom';

type Lang = 'es' | 'en';

const ES = {
  title: 'Política de Privacidad',
  subtitle: 'Última actualización: Mayo 2026',
  intro: 'En Fiesta y Lista nos comprometemos a proteger tu privacidad. Esta política describe cómo recopilamos, usamos, almacenamos y protegemos tus datos personales, en cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normativas aplicables en Colombia.',
  sections: [
    {
      title: '1. Datos que Recopilamos',
      content: 'Recopilamos los siguientes datos personales: (a) Información de registro: nombre, correo electrónico y contraseña cifrada; (b) Información de perfil: nombre de usuario y preferencias; (c) Datos de uso: información sobre cómo interactúas con la plataforma; (d) Datos de pago: procesados exclusivamente por Mercado Pago, nosotros no almacenamos información financiera; (e) Datos técnicos: dirección IP, tipo de navegador, sistema operativo y cookies analíticas esenciales.',
    },
    {
      title: '2. Finalidad del Tratamiento',
      content: 'Tus datos se utilizan para: (a) Proveer y mantener el servicio de listas de regalos; (b) Procesar pagos y suscripciones; (c) Enviar notificaciones relacionadas con el servicio; (d) Mejorar la plataforma basándonos en patrones de uso; (e) Cumplir con obligaciones legales y regulatorias; (f) Prevenir fraudes y abusos. No utilizamos tus datos para fines de marketing sin tu consentimiento explícito.',
    },
    {
      title: '3. Base Legal',
      content: 'El tratamiento de tus datos se fundamenta en: (a) La ejecución del contrato de servicios aceptado al registrarte; (b) Tu consentimiento explícito para cookies y datos adicionales; (c) El interés legítimo del responsable del tratamiento; (d) El cumplimiento de obligaciones legales aplicables.',
    },
    {
      title: '4. Almacenamiento y Seguridad',
      content: 'Tus datos se almacenan en servidores seguros con cifrado en tránsito (TLS 1.3) y en reposo (AES-256). Implementamos medidas técnicas y organizativas para proteger tus datos, incluyendo: autenticación segura, monitoreo de accesos, y backups periódicos. Los datos se conservan mientras mantengas una cuenta activa y hasta 2 años después para cumplir con obligaciones legales.',
    },
    {
      title: '5. Derechos ARCO',
      content: 'De acuerdo con la Ley 1581 de 2012, tienes derecho a: Acceso: conocer qué datos tenemos tuyos; Rectificación: solicitar corrección de datos inexactos; Cancelación: solicitar la eliminación de tus datos; Oposición: oponerte al tratamiento de tus datos. Puedes ejercer estos derechos desde la sección "Derechos ARCO" en nuestra plataforma o contactándonos directamente.',
    },
    {
      title: '6. Transferencia de Datos',
      content: 'Tus datos personales no serán transferidos a terceros sin tu consentimiento, excepto: (a) Proveedores de servicios esenciales (Mercado Pago para pagos, Cloudinary para almacenamiento de imágenes, Resend para envío de correos); (b) Autoridades competentes cuando la ley lo requiera; (c) En caso de fusión o adquisición, con notificación previa.',
    },
    {
      title: '7. Cookies',
      content: 'Utilizamos cookies esenciales para el funcionamiento de la plataforma y cookies analíticas para mejorar tu experiencia. Puedes configurar tus preferencias de cookies en nuestro banner de cookies. Las cookies esenciales no requieren consentimiento; las analíticas y de marketing requieren tu aceptación explícita.',
    },
    {
      title: '8. Datos de Menores',
      content: 'La plataforma está diseñada para usuarios mayores de 14 años. No recopilamos intencionalmente datos de menores de 14 años. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos inmediatamente.',
    },
    {
      title: '9. Cambios a esta Política',
      content: 'Podemos actualizar esta política periódicamente. Los cambios significativos serán notificados con 15 días de antelación a través de la plataforma o por correo electrónico. El uso continuado del servicio después de los cambios constituye aceptación de la política actualizada.',
    },
    {
      title: '10. Contacto',
      content: 'Para ejercer tus derechos ARCO o resolver cualquier duda sobre privacidad, utiliza nuestro formulario de Derechos ARCO en la plataforma.',
    },
  ],
  footer: '© {year} fiestaylista.com. Todos los derechos reservados.',
};

const EN = {
  title: 'Privacy Policy',
  subtitle: 'Last updated: May 2026',
  intro: 'At Fiesta y Lista, we are committed to protecting your privacy. This policy describes how we collect, use, store, and protect your personal data, in compliance with Colombian Law 1581 of 2012, Decree 1377 of 2013, and other applicable regulations.',
  sections: [
    {
      title: '1. Data We Collect',
      content: 'We collect the following personal data: (a) Registration information: name, email, and encrypted password; (b) Profile information: username and preferences; (c) Usage data: information about how you interact with the platform; (d) Payment data: processed exclusively by Mercado Pago, we do not store financial information; (e) Technical data: IP address, browser type, operating system, and essential analytical cookies.',
    },
    {
      title: '2. Purpose of Processing',
      content: 'Your data is used to: (a) Provide and maintain the gift list service; (b) Process payments and subscriptions; (c) Send service-related notifications; (d) Improve the platform based on usage patterns; (e) Comply with legal and regulatory obligations; (f) Prevent fraud and abuse. We do not use your data for marketing purposes without your explicit consent.',
    },
    {
      title: '3. Legal Basis',
      content: 'The processing of your data is based on: (a) The execution of the service contract accepted when registering; (b) Your explicit consent for cookies and additional data; (c) The legitimate interest of the data controller; (d) Compliance with applicable legal obligations.',
    },
    {
      title: '4. Storage and Security',
      content: 'Your data is stored on secure servers with encryption in transit (TLS 1.3) and at rest (AES-256). We implement technical and organizational measures to protect your data, including: secure authentication, access monitoring, and periodic backups. Data is retained while you maintain an active account and up to 2 years thereafter to comply with legal obligations.',
    },
    {
      title: '5. ARCO Rights',
      content: 'In accordance with Law 1581 of 2012, you have the right to: Access: know what data we have about you; Rectification: request correction of inaccurate data; Cancellation: request deletion of your data; Opposition: object to the processing of your data. You can exercise these rights from the "ARCO Rights" section of our platform or by contacting us directly.',
    },
    {
      title: '6. Data Transfer',
      content: 'Your personal data will not be transferred to third parties without your consent, except: (a) Essential service providers (Mercado Pago for payments, Cloudinary for image storage, Resend for email delivery); (b) Competent authorities when required by law; (c) In case of merger or acquisition, with prior notice.',
    },
    {
      title: '7. Cookies',
      content: 'We use essential cookies for the platform to function and analytical cookies to improve your experience. You can configure your cookie preferences in our cookie banner. Essential cookies do not require consent; analytical and marketing cookies require your explicit acceptance.',
    },
    {
      title: '8. Children\'s Data',
      content: 'The platform is designed for users over 14 years of age. We do not intentionally collect data from children under 14. If we discover that we have collected data from a minor, we will delete it immediately.',
    },
    {
      title: '9. Changes to This Policy',
      content: 'We may update this policy periodically. Significant changes will be notified 15 days in advance through the platform or by email. Continued use of the service after changes constitutes acceptance of the updated policy.',
    },
    {
      title: '10. Contact',
      content: 'To exercise your ARCO rights or resolve any questions about privacy, use our ARCO Rights form on the platform.',
    },
  ],
  footer: '© {year} fiestaylista.com. All rights reserved.',
};

export default function PrivacyPolicy() {
  const [lang, setLang] = useState<Lang>('es');
  const content = lang === 'es' ? ES : EN;

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-primary hover:text-primary-fixed-dim text-sm font-medium">
              ← Volver / Back
            </Link>
            <h1 className="text-3xl font-bold text-on-surface mt-2">{content.title}</h1>
            <p className="text-sm text-on-surface-variant mt-1">{content.subtitle}</p>
          </div>
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant bg-surface border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors"
          >
            {lang === 'es' ? 'English' : 'Español'}
          </button>
        </div>

        <div className="rounded-2xl p-8 sm:p-10 glass-card-premium">
          <p className="text-on-surface-variant mb-8">{content.intro}</p>

          <div className="space-y-8">
            {content.sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-xl font-semibold text-on-surface mb-3">{section.title}</h2>
                <p className="text-on-surface-variant leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-outline-variant">
            <p className="text-sm text-on-surface-variant">
              {content.footer.replace('{year}', String(new Date().getFullYear()))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

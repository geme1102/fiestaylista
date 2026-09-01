import { useState } from 'react';
import { Link } from 'react-router-dom';

type Lang = 'es' | 'en';

const ES = {
  title: 'Términos y Condiciones',
  subtitle: 'Última actualización: Mayo 2026',
  intro: 'Bienvenido a Fiesta y Lista. Al acceder y utilizar esta plataforma, aceptas cumplir con los siguientes términos y condiciones. Si no estás de acuerdo, por favor no uses nuestros servicios.',
  sections: [
    {
      title: '1. Información General',
      content: 'Fiesta y Lista es una plataforma propiedad de Fiesta y Lista. El uso de la plataforma implica la aceptación plena de estos términos. Nos reservamos el derecho de modificar estos términos en cualquier momento, notificando los cambios con 15 días de antelación.',
    },
    {
      title: '2. Registro y Cuenta',
      content: 'Para acceder a ciertas funcionalidades, debes registrarte proporcionando información veraz y actualizada. Eres responsable de mantener la confidencialidad de tus credenciales y de todas las actividades realizadas bajo tu cuenta. Debes ser mayor de 14 años para registrarte.',
    },
    {
      title: '3. Propiedad Intelectual',
      content: 'Todos los derechos de propiedad intelectual sobre la plataforma, incluyendo código fuente, diseño, logotipos, marcas y contenido, pertenecen a Fiesta y Lista. Queda prohibida la reproducción, distribución o modificación no autorizada del software o su contenido. El usuario conserva la propiedad de los datos que ingresa en la plataforma (listas de regalos, fotos, etc.), otorgando a Fiesta y Lista una licencia limitada para operar y mostrar dichos contenidos dentro de la plataforma.',
    },
    {
      title: '4. Uso de la Plataforma',
      content: 'Te comprometes a usar la plataforma únicamente para fines legales y de acuerdo con estos términos. No puedes: (a) utilizar la plataforma para actividades ilícitas; (b) intentar acceder a cuentas de otros usuarios; (c) introducir malware o código malicioso; (d) realizar ingeniería inversa del software; (e) realizar más de 100 solicitudes por minuto a nuestra API sin autorización.',
    },
    {
      title: '5. Servicios de Pago',
      content: 'Los servicios premium se procesan a través de Mercado Pago. Los precios se muestran en pesos colombianos (COP) e incluyen IVA cuando aplica. Las suscripciones se renuevan automáticamente a menos que se cancelen antes de la fecha de facturación. Puedes cancelar en cualquier momento desde tu panel de cuenta. No se realizarán reembolsos por períodos parciales.',
    },
    {
      title: '6. Limitación de Responsabilidad',
      content: 'Fiesta y Lista se proporciona "tal cual", sin garantías de disponibilidad continua. No nos hacemos responsables por: (a) daños directos o indirectos derivados del uso de la plataforma; (b) pérdida de datos; (c) interrupciones del servicio por mantenimiento o causas ajenas a nuestra voluntad. Nuestra responsabilidad máxima se limita al valor pagado por el servicio en los últimos 12 meses.',
    },
    {
      title: '7. Protección de Datos',
      content: 'El tratamiento de tus datos personales se rige por nuestra Política de Privacidad, en cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013. Recopilamos únicamente los datos necesarios para el funcionamiento del servicio. Puedes ejercer tus derechos ARCO en cualquier momento.',
    },
    {
      title: '8. Ley Aplicable y Jurisdicción',
      content: 'Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia será sometida a los jueces de la ciudad de Bogotá D.C., Colombia. Para reclamaciones, contáctanos en nuestro formulario de derechos ARCO.',
    },
    {
      title: '9. Contacto',
      content: 'Para consultas sobre estos términos, puedes ejercer tus derechos a través de nuestra página de Derechos ARCO.',
    },
  ],
  footer: '© {year} fiestaylista.com. Todos los derechos reservados.',
};

const EN = {
  title: 'Terms and Conditions',
  subtitle: 'Last updated: May 2026',
  intro: 'Welcome to Fiesta y Lista. By accessing and using this platform, you agree to comply with the following terms and conditions. If you do not agree, please do not use our services.',
  sections: [
    {
      title: '1. General Information',
      content: 'Fiesta y Lista is a platform owned by Fiesta y Lista. Use of the platform implies full acceptance of these terms. We reserve the right to modify these terms at any time, notifying changes 15 days in advance.',
    },
    {
      title: '2. Registration and Account',
      content: 'To access certain features, you must register providing truthful and updated information. You are responsible for maintaining the confidentiality of your credentials and all activities under your account. You must be at least 14 years old to register.',
    },
    {
      title: '3. Intellectual Property',
      content: 'All intellectual property rights over the platform, including source code, design, logos, trademarks, and content, belong to Fiesta y Lista. Unauthorized reproduction, distribution, or modification of the software or its content is prohibited. The user retains ownership of data entered into the platform (gift lists, photos, etc.), granting Fiesta y Lista a limited license to operate and display such content within the platform.',
    },
    {
      title: '4. Platform Use',
      content: 'You agree to use the platform only for lawful purposes and in accordance with these terms. You may not: (a) use the platform for illegal activities; (b) attempt to access other users\' accounts; (c) introduce malware or malicious code; (d) reverse engineer the software; (e) make more than 100 requests per minute to our API without authorization.',
    },
    {
      title: '5. Payment Services',
      content: 'Premium services are processed through Mercado Pago. Prices are shown in Colombian pesos (COP) and include VAT where applicable. Subscriptions renew automatically unless canceled before the billing date. You can cancel at any time from your account dashboard. No refunds will be issued for partial periods.',
    },
    {
      title: '6. Limitation of Liability',
      content: 'Fiesta y Lista is provided "as is", without warranties of continuous availability. We are not responsible for: (a) direct or indirect damages arising from the use of the platform; (b) data loss; (c) service interruptions due to maintenance or causes beyond our control. Our maximum liability is limited to the amount paid for the service in the last 12 months.',
    },
    {
      title: '7. Data Protection',
      content: 'The processing of your personal data is governed by our Privacy Policy, in compliance with Colombian Law 1581 of 2012 and Decree 1377 of 2013. We only collect the data necessary for the operation of the service. You can exercise your ARCO rights at any time.',
    },
    {
      title: '8. Governing Law and Jurisdiction',
      content: 'These terms are governed by the laws of the Republic of Colombia. Any dispute shall be submitted to the courts of Bogotá D.C., Colombia. For claims, contact us through our ARCO rights form.',
    },
    {
      title: '9. Contact',
      content: 'For inquiries about these terms, you can exercise your rights through our ARCO Rights page.',
    },
  ],
  footer: '© {year} fiestaylista.com. All rights reserved.',
};

export default function TermsConditions() {
  const [lang, setLang] = useState<Lang>('es');
  const content = lang === 'es' ? ES : EN;

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-surface">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-primary hover:text-primary-fixed-dim text-sm font-medium">
              ← Volver
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
    </main>
  );
}

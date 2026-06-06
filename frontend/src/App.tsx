import { Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SplashIntro from './components/SplashIntro';
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EventAdmin = lazy(() => import('./pages/EventAdmin'));
const EventGuest = lazy(() => import('./pages/EventGuest'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Account = lazy(() => import('./pages/Account'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const TermsConditions = lazy(() => import('./pages/TermsConditions'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const CookiesPolicy = lazy(() => import('./pages/CookiesPolicy'));
const ArcoRights = lazy(() => import('./pages/ArcoRights'));
const NotFound = lazy(() => import('./pages/NotFound'));
const SeoEventPage = lazy(() => import('./pages/SeoEventPage'));

const PAGE_META: Record<string, { title: string; desc: string; keywords?: string }> = {
  '/': {
    title: 'Fiesta y Lista - Crea tu lista de regalos',
    desc: 'Fiesta y Lista — la app colombiana para crear listas de regalos. Baby showers, bodas, cumpleaños. Tus invitados apartan regalos sin registrarse.',
    keywords: 'fiestaylista, lista de regalos, baby shower, boda, cumpleaños, Colombia',
  },
  '/login': {
    title: 'Iniciar Sesión - Fiesta y Lista',
    desc: 'Inicia sesión en Fiesta y Lista para administrar tus listas de regalos y eventos.',
  },
  '/register': {
    title: 'Registrarse - Fiesta y Lista',
    desc: 'Crea tu cuenta gratis en Fiesta y Lista y empieza a organizar tus listas de regalos en 2 minutos.',
  },
  '/pricing': {
    title: 'Planes - Fiesta y Lista',
    desc: 'Planes y precios de Fiesta y Lista. Plan gratis y Pro desde $24.990/mes. Sin tarjeta de crédito para empezar.',
    keywords: 'fiestaylista planes, lista de regalos precios, plan pro, suscripción',
  },
  '/dashboard': {
    title: 'Mis Eventos - Fiesta y Lista',
    desc: 'Administra tus eventos y listas de regalos en Fiesta y Lista.',
  },
  '/account': {
    title: 'Mi Cuenta - Fiesta y Lista',
    desc: 'Configuración de tu cuenta en Fiesta y Lista.',
  },
  '/onboarding': {
    title: 'Primeros Pasos - Fiesta y Lista',
    desc: 'Guía de primeros pasos en Fiesta y Lista. Aprende a crear tu primera lista de regalos.',
  },
  '/verify-email': {
    title: 'Verificar Correo - Fiesta y Lista',
    desc: 'Verifica tu dirección de correo electrónico en Fiesta y Lista.',
  },
  '/forgot-password': {
    title: 'Recuperar Contraseña - Fiesta y Lista',
    desc: 'Recupera tu contraseña de Fiesta y Lista.',
  },
  '/reset-password': {
    title: 'Nueva Contraseña - Fiesta y Lista',
    desc: 'Establece una nueva contraseña para tu cuenta de Fiesta y Lista.',
  },
  '/terminos-y-condiciones': {
    title: 'Términos y Condiciones - Fiesta y Lista',
    desc: 'Términos y condiciones de uso de Fiesta y Lista.',
  },
  '/terms-and-conditions': {
    title: 'Términos y Condiciones - Fiesta y Lista',
    desc: 'Términos y condiciones de uso de Fiesta y Lista.',
  },
  '/politica-de-privacidad': {
    title: 'Política de Privacidad - Fiesta y Lista',
    desc: 'Política de privacidad de Fiesta y Lista. Conoce cómo protegemos tus datos.',
  },
  '/privacy-policy': {
    title: 'Política de Privacidad - Fiesta y Lista',
    desc: 'Política de privacidad de Fiesta y Lista.',
  },
  '/politica-de-cookies': {
    title: 'Política de Cookies - Fiesta y Lista',
    desc: 'Política de cookies de Fiesta y Lista.',
  },
  '/cookies-policy': {
    title: 'Política de Cookies - Fiesta y Lista',
    desc: 'Política de cookies de Fiesta y Lista.',
  },
  '/derechos-arco': {
    title: 'Derechos ARCO - Fiesta y Lista',
    desc: 'Ejerce tus derechos de acceso, rectificación, cancelación y oposición en Fiesta y Lista.',
  },
  '/arco-rights': {
    title: 'Derechos ARCO - Fiesta y Lista',
    desc: 'Ejerce tus derechos ARCO en Fiesta y Lista.',
  },
  '/baby-shower': {
    title: 'Baby Shower - Fiesta y Lista',
    desc: 'Crea tu lista de regalos para baby shower en Fiesta y Lista. Los invitados apartan sin registrarse. La mejor app de listas de baby shower en Colombia.',
    keywords: 'fiestaylista baby shower, lista de regalos baby shower, baby shower Colombia',
  },
  '/boda': {
    title: 'Boda - Fiesta y Lista',
    desc: 'Crea tu lista de regalos de boda en Fiesta y Lista. Tus invitados eligen y apartan regalos sin duplicar. Lluvia de Sobres para luna de miel.',
    keywords: 'fiestaylista boda, lista de regalos boda, lista de bodas Colombia',
  },
  '/cumpleanos': {
    title: 'Cumpleaños - Fiesta y Lista',
    desc: 'Organiza los regalos de cumpleaños con Fiesta y Lista. Dile adiós a los regalos repetidos.',
    keywords: 'fiestaylista cumpleaños, lista de regalos cumpleaños',
  },
  '/bautizo': {
    title: 'Bautizo - Fiesta y Lista',
    desc: 'Crea tu lista de regalos para bautizo en Fiesta y Lista. Padrinos y familiares apartan sin registrarse.',
    keywords: 'fiestaylista bautizo, lista de regalos bautizo',
  },
  '/comunion': {
    title: 'Comunión - Fiesta y Lista',
    desc: 'Organiza los regalos de primera comunión con Fiesta y Lista. Fácil, rápido y gratis.',
    keywords: 'fiestaylista comunión, lista de regalos comunión',
  },
};

function TitleUpdater() {
  const location = useLocation();
  const path = location.pathname;
  let meta = PAGE_META[path] || PAGE_META['/'];

  if (!PAGE_META[path]) {
    if (path.startsWith('/e/')) {
      meta = {
        title: 'Lista de Regalos - Fiesta y Lista',
        desc: 'Aparta regalos para baby showers, bodas, cumpleaños y más. Fiesta y Lista — la app de listas de regalos.',
        keywords: 'fiestaylista, lista de regalos, apartar regalo',
      };
    } else if (path.startsWith('/event/')) {
      meta = {
        title: 'Administrar Evento - Fiesta y Lista',
        desc: 'Administra tu evento y lista de regalos en Fiesta y Lista.',
      };
    }
  }

  const title = meta.title;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={meta.desc} />
      {(meta as any).keywords && <meta name="keywords" content={(meta as any).keywords} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={meta.desc} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={meta.desc} />
      <meta property="og:url" content={`${window.location.origin}${path}`} />
      <meta property="og:locale" content="es_CO" />
      <meta property="og:image" content="https://fiestaylista.com/og-image.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Fiesta y Lista — Crea tu lista de regalos para baby showers, bodas, cumpleaños y más" />
      <meta name="twitter:image" content="https://fiestaylista.com/og-image.png" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={`https://fiestaylista.com${path}`} />
      <link rel="alternate" href={`https://fiestaylista.com${path}`} hrefLang="es-CO" />
      <link rel="alternate" href={`https://fiestaylista.com${path}`} hrefLang="es" />
    </Helmet>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(() => localStorage.getItem('splash_seen') === 'true');
  const handleSplashDone = useCallback(() => {
    localStorage.setItem('splash_seen', 'true');
    setSplashDone(true);
  }, []);

  if (!splashDone) {
    return <SplashIntro onComplete={handleSplashDone} />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <TitleUpdater />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/e/:slug" element={<EventGuest />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/baby-shower" element={<SeoEventPage eventKey="baby-shower" />} />
        <Route path="/boda" element={<SeoEventPage eventKey="boda" />} />
        <Route path="/cumpleanos" element={<SeoEventPage eventKey="cumpleanos" />} />
        <Route path="/bautizo" element={<SeoEventPage eventKey="bautizo" />} />
        <Route path="/comunion" element={<SeoEventPage eventKey="comunion" />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/event/:id" element={<EventAdmin />} />
            <Route path="/account" element={<Account />} />
          </Route>
          <Route path="/onboarding" element={<Onboarding />} />
        </Route>
        <Route path="/terminos-y-condiciones" element={<TermsConditions />} />
        <Route path="/terms-and-conditions" element={<TermsConditions />} />
        <Route path="/politica-de-privacidad" element={<PrivacyPolicy />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/politica-de-cookies" element={<CookiesPolicy />} />
        <Route path="/cookies-policy" element={<CookiesPolicy />} />
        <Route path="/derechos-arco" element={<ArcoRights />} />
        <Route path="/arco-rights" element={<ArcoRights />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

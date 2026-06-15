import { Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useState, useCallback, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SplashIntro from './components/SplashIntro';
import ErrorBoundary from './components/ErrorBoundary';
import { QueryProvider } from './components/QueryProvider';
import { PAGE_META } from './data/pageMeta';

function PageBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
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

function TitleUpdater() {
  const location = useLocation();
  const path = location.pathname;
  let meta = PAGE_META[path] || PAGE_META['/'];
  let isUnknown = false;

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
    } else {
      isUnknown = true;
      meta = {
        title: 'Página no encontrada - Fiesta y Lista',
        desc: 'La página que buscas no existe en Fiesta y Lista. Vuelve al inicio para descubrir listas de regalos.',
      };
    }
  }

  const title = meta.title;

  const EN_TO_ES: Record<string, string> = {
    '/terms-and-conditions': '/terminos-y-condiciones',
    '/privacy-policy': '/politica-de-privacidad',
    '/cookies-policy': '/politica-de-cookies',
    '/arco-rights': '/derechos-arco',
  };

  const canonicalPath = EN_TO_ES[path] || path;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={meta.desc} />
      {'keywords' in meta && <meta name="keywords" content={meta.keywords as string} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={meta.desc} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={meta.desc} />
      <meta property="og:url" content={`${window.location.origin}${canonicalPath}`} />
      <meta property="og:locale" content="es_CO" />
      <meta property="og:image" content="https://fiestaylista.com/og-image.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Fiesta y Lista — Crea tu lista de regalos para baby showers, bodas, cumpleaños y más" />
      <meta name="twitter:image" content="https://fiestaylista.com/og-image.png" />
      <meta name="robots" content={isUnknown ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={`${window.location.origin}${canonicalPath}`} />
      <link rel="alternate" href={`${window.location.origin}${canonicalPath}`} hrefLang="es-CO" />
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": title,
          "description": meta.desc,
          "url": `${window.location.origin}${canonicalPath}`,
          "inLanguage": "es-CO",
          "isPartOf": {
            "@type": "WebApplication",
            "name": "Fiesta y Lista",
            "url": "https://fiestaylista.com"
          }
        })}
      </script>
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
    <QueryProvider>
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <TitleUpdater />
      <Routes>
        <Route path="/" element={<PageBoundary><Landing /></PageBoundary>} />
        <Route path="/login" element={<PageBoundary><Login /></PageBoundary>} />
        <Route path="/register" element={<PageBoundary><Register /></PageBoundary>} />
        <Route path="/pricing" element={<PageBoundary><Pricing /></PageBoundary>} />
        <Route path="/e/:slug" element={<PageBoundary><EventGuest /></PageBoundary>} />
        <Route path="/verify-email" element={<PageBoundary><VerifyEmail /></PageBoundary>} />
        <Route path="/forgot-password" element={<PageBoundary><ForgotPassword /></PageBoundary>} />
        <Route path="/reset-password" element={<PageBoundary><ResetPassword /></PageBoundary>} />
        <Route path="/baby-shower" element={<PageBoundary><SeoEventPage eventKey="baby-shower" /></PageBoundary>} />
        <Route path="/boda" element={<PageBoundary><SeoEventPage eventKey="boda" /></PageBoundary>} />
        <Route path="/cumpleanos" element={<PageBoundary><SeoEventPage eventKey="cumpleanos" /></PageBoundary>} />
        <Route path="/bautizo" element={<PageBoundary><SeoEventPage eventKey="bautizo" /></PageBoundary>} />
        <Route path="/comunion" element={<PageBoundary><SeoEventPage eventKey="comunion" /></PageBoundary>} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<PageBoundary><Dashboard /></PageBoundary>} />
            <Route path="/event/:id" element={<PageBoundary><EventAdmin /></PageBoundary>} />
            <Route path="/account" element={<PageBoundary><Account /></PageBoundary>} />
          </Route>
          <Route path="/onboarding" element={<PageBoundary><Onboarding /></PageBoundary>} />
        </Route>
        <Route path="/terminos-y-condiciones" element={<PageBoundary><TermsConditions /></PageBoundary>} />
        <Route path="/terms-and-conditions" element={<PageBoundary><TermsConditions /></PageBoundary>} />
        <Route path="/politica-de-privacidad" element={<PageBoundary><PrivacyPolicy /></PageBoundary>} />
        <Route path="/privacy-policy" element={<PageBoundary><PrivacyPolicy /></PageBoundary>} />
        <Route path="/politica-de-cookies" element={<PageBoundary><CookiesPolicy /></PageBoundary>} />
        <Route path="/cookies-policy" element={<PageBoundary><CookiesPolicy /></PageBoundary>} />
        <Route path="/derechos-arco" element={<PageBoundary><ArcoRights /></PageBoundary>} />
        <Route path="/arco-rights" element={<PageBoundary><ArcoRights /></PageBoundary>} />
        <Route path="*" element={<PageBoundary><NotFound /></PageBoundary>} />
      </Routes>
    </Suspense>
    </QueryProvider>
  );
}

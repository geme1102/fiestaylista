import { Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useState, useCallback, useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SplashIntro from './components/SplashIntro';
import Logo from './components/Logo';
import ErrorBoundary from './components/ErrorBoundary';
import { reportError } from './lib/reportError';
import { QueryProvider } from './components/QueryProvider';
import { PAGE_META } from './data/pageMeta';

function PageBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

function PageTransition({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) {
    return <>{children}</>;
  }
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
function PwaUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let refreshing = false;
    const handler = () => {
      if (refreshing) return;
      refreshing = true;
      setUpdateAvailable(true);
    };
    navigator.serviceWorker?.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', handler);
  }, []);

  if (!updateAvailable) return null;

  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] bg-primary text-on-primary px-6 py-3 rounded-2xl shadow-2xl font-semibold text-sm animate-fade-in cursor-pointer hover:scale-105 transition-transform"
      role="status"
    >
      <span className="material-symbols-outlined text-sm align-middle mr-2" aria-hidden="true">system_update</span>
      ¡Nueva versión disponible! Toca para actualizar
    </button>
  );
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
const Statistics = lazy(() => import('./pages/Statistics'));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('main-content');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }, [pathname]);

  return null;
}

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

  const ES_TO_EN: Record<string, string> = {
    '/terminos-y-condiciones': '/terms-and-conditions',
    '/politica-de-privacidad': '/privacy-policy',
    '/politica-de-cookies': '/cookies-policy',
    '/derechos-arco': '/arco-rights',
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
      {ES_TO_EN[canonicalPath] && (
        <link rel="alternate" href={`${window.location.origin}${ES_TO_EN[canonicalPath]}`} hrefLang="en" />
      )}
      <link rel="alternate" href={`${window.location.origin}${canonicalPath}`} hrefLang="x-default" />
    </Helmet>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(() => {
    try {
      return localStorage.getItem('splash_seen') === 'true';
    } catch (err) {
      reportError(err, { source: 'App' });
      return false;
    }
  });
  const handleSplashDone = useCallback(() => {
    try {
      localStorage.setItem('splash_seen', 'true');
    } catch (err) {
      reportError(err, { source: 'App' });
    }
    setSplashDone(true);
  }, []);
  const location = useLocation();

  if (!splashDone) {
    return <SplashIntro onComplete={handleSplashDone} />;
  }

  return (
    <QueryProvider>
      <PwaUpdater />
      <ScrollToTop />
    <Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface"><Logo className="w-16 h-16" alt="Fiesta y Lista" /><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /><p className="text-sm text-on-surface-variant/70 font-medium animate-pulse">Cargando...</p></div>}>
      <TitleUpdater />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><PageBoundary><Landing /></PageBoundary></PageTransition>} />
          <Route path="/login" element={<PageTransition><PageBoundary><Login /></PageBoundary></PageTransition>} />
          <Route path="/register" element={<PageTransition><PageBoundary><Register /></PageBoundary></PageTransition>} />
          <Route path="/pricing" element={<PageTransition><PageBoundary><Pricing /></PageBoundary></PageTransition>} />
          <Route path="/e/:slug" element={<PageTransition><PageBoundary><EventGuest /></PageBoundary></PageTransition>} />
          <Route path="/verify-email" element={<PageTransition><PageBoundary><VerifyEmail /></PageBoundary></PageTransition>} />
          <Route path="/forgot-password" element={<PageTransition><PageBoundary><ForgotPassword /></PageBoundary></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><PageBoundary><ResetPassword /></PageBoundary></PageTransition>} />
          <Route path="/baby-shower" element={<PageTransition><PageBoundary><SeoEventPage eventKey="baby-shower" /></PageBoundary></PageTransition>} />
          <Route path="/boda" element={<PageTransition><PageBoundary><SeoEventPage eventKey="boda" /></PageBoundary></PageTransition>} />
          <Route path="/cumpleanos" element={<PageTransition><PageBoundary><SeoEventPage eventKey="cumpleanos" /></PageBoundary></PageTransition>} />
          <Route path="/bautizo" element={<PageTransition><PageBoundary><SeoEventPage eventKey="bautizo" /></PageBoundary></PageTransition>} />
          <Route path="/comunion" element={<PageTransition><PageBoundary><SeoEventPage eventKey="comunion" /></PageBoundary></PageTransition>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<PageTransition><PageBoundary><Dashboard /></PageBoundary></PageTransition>} />
              <Route path="/event/:id" element={<PageTransition><PageBoundary><EventAdmin /></PageBoundary></PageTransition>} />
              <Route path="/account" element={<PageTransition><PageBoundary><Account /></PageBoundary></PageTransition>} />
              <Route path="/statistics" element={<PageTransition><PageBoundary><Statistics /></PageBoundary></PageTransition>} />
            </Route>
            <Route path="/onboarding" element={<PageTransition><PageBoundary><Onboarding /></PageBoundary></PageTransition>} />
          </Route>
          <Route path="/terminos-y-condiciones" element={<PageTransition><PageBoundary><TermsConditions /></PageBoundary></PageTransition>} />
          <Route path="/terms-and-conditions" element={<PageTransition><PageBoundary><TermsConditions /></PageBoundary></PageTransition>} />
          <Route path="/politica-de-privacidad" element={<PageTransition><PageBoundary><PrivacyPolicy /></PageBoundary></PageTransition>} />
          <Route path="/privacy-policy" element={<PageTransition><PageBoundary><PrivacyPolicy /></PageBoundary></PageTransition>} />
          <Route path="/politica-de-cookies" element={<PageTransition><PageBoundary><CookiesPolicy /></PageBoundary></PageTransition>} />
          <Route path="/cookies-policy" element={<PageTransition><PageBoundary><CookiesPolicy /></PageBoundary></PageTransition>} />
          <Route path="/derechos-arco" element={<PageTransition><PageBoundary><ArcoRights /></PageBoundary></PageTransition>} />
          <Route path="/arco-rights" element={<PageTransition><PageBoundary><ArcoRights /></PageBoundary></PageTransition>} />
          <Route path="*" element={<PageTransition><PageBoundary><NotFound /></PageBoundary></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
    </QueryProvider>
  );
}

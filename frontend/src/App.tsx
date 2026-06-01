import { Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';

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

const PAGE_TITLES: Record<string, string> = {
  '/': 'Fiesta y Lista - Crea tu lista de regalos',
  '/login': 'Iniciar Sesión - Fiesta y Lista',
  '/register': 'Registrarse - Fiesta y Lista',
  '/pricing': 'Planes - Fiesta y Lista',
  '/dashboard': 'Mis Eventos - Fiesta y Lista',
  '/account': 'Mi Cuenta - Fiesta y Lista',
  '/onboarding': 'Primeros Pasos - Fiesta y Lista',
  '/verify-email': 'Verificar Correo - Fiesta y Lista',
  '/forgot-password': 'Recuperar Contraseña - Fiesta y Lista',
  '/reset-password': 'Nueva Contraseña - Fiesta y Lista',
  '/terminos-y-condiciones': 'Términos y Condiciones - Fiesta y Lista',
  '/terms-and-conditions': 'Términos y Condiciones - Fiesta y Lista',
  '/politica-de-privacidad': 'Política de Privacidad - Fiesta y Lista',
  '/privacy-policy': 'Política de Privacidad - Fiesta y Lista',
  '/politica-de-cookies': 'Política de Cookies - Fiesta y Lista',
  '/cookies-policy': 'Política de Cookies - Fiesta y Lista',
  '/derechos-arco': 'Derechos ARCO - Fiesta y Lista',
  '/arco-rights': 'Derechos ARCO - Fiesta y Lista',
  '/baby-shower': 'Baby Shower - Fiesta y Lista',
  '/boda': 'Boda - Fiesta y Lista',
  '/cumpleanos': 'Cumpleaños - Fiesta y Lista',
  '/bautizo': 'Bautizo - Fiesta y Lista',
  '/comunion': 'Comunión - Fiesta y Lista',
};

function TitleUpdater() {
  const location = useLocation();
  const path = location.pathname;
  let title = PAGE_TITLES[path];

  if (!title) {
    if (path.startsWith('/e/')) {
      title = 'Lista de Regalos - Fiesta y Lista';
    } else if (path.startsWith('/event/')) {
      title = 'Administrar Evento - Fiesta y Lista';
    } else {
      title = PAGE_TITLES['/'];
    }
  }

  return (
    <Helmet>
      <title>{title}</title>
      <meta property="og:title" content={title} />
      <meta name="twitter:title" content={title} />
      <meta property="og:url" content={`${window.location.origin}${path}`} />
    </Helmet>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
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

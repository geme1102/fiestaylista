import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import * as Sentry from '@sentry/react';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import CookieBanner from './components/CookieBanner';
import App from './App';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (!reason) return;

  // Filter out third-party errors (extensions, Turnstile, CDN scripts, etc.)
  if (reason instanceof Error && reason.stack) {
    const isThirdParty =
      reason.stack.includes('chrome-extension://') ||
      reason.stack.includes('moz-extension://') ||
      reason.stack.includes('extensions') ||
      reason.stack.includes('turnstile') ||
      reason.stack.includes('challenges.cloudflare.com');
    if (isThirdParty) return;
  }

  console.warn('[global] Unhandled rejection:', reason);
  toast.error('Ocurrió un error inesperado. Recarga la página si el problema persiste.');
});

window.onerror = (_message, _source, _lineno, _colno, error) => {
  if (!error) return;
  console.warn('[global] Unhandled error:', error);
  toast.error('Ocurrió un error inesperado. Recarga la página si el problema persiste.');
};

if (import.meta.env.VITE_SENTRY_DSN) {
  let analyticsConsented = false;
  try {
    const stored = localStorage.getItem('cookie_consent_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      analyticsConsented = parsed.analytics === true;
    }
  } catch {}

  if (analyticsConsented) {
    try {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [
          Sentry.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
          }),
          Sentry.browserTracingIntegration(),
        ],
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
        replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
        replaysOnErrorSampleRate: 1.0,
      });
    } catch (e) {
      console.error('[sentry] Error inicializando Sentry:', e);
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <MotionConfig reducedMotion="user">
              <App />
              <CookieBanner />
              <Toaster
                richColors
                closeButton
                position="bottom-center"
                toastOptions={{
                  style: { fontFamily: 'Plus Jakarta Sans, sans-serif' },
                }}
                data-testid="toaster"
              />
            </MotionConfig>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);

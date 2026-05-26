import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import CookieBanner from './components/CookieBanner';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <App />
              <CookieBanner />
              <Toaster
                richColors
                closeButton
                position="bottom-center"
                toastOptions={{
                  style: { fontFamily: 'Quicksand, sans-serif' },
                }}
              />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);

import { useEffect, useRef, useCallback, useState } from 'react';
import { useInAppBrowser } from './useInAppBrowser';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        appearance?: 'always' | 'execute' | 'interaction-only';
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      execute: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export async function waitForTurnstile(
  getToken: () => string | null,
  maxAttempts = 25,
  intervalMs = 200,
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const token = getToken();
    if (token) return token;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const MAX_ERROR_TOTAL = 5;
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isWebview, isIOS } = useInAppBrowser();

  const webviewRef = useRef({ isWebview, isIOS });
  webviewRef.current = { isWebview, isIOS };

  const buildErrorMessage = useCallback((baseMsg: string) => {
    const { isWebview: wv, isIOS: ios } = webviewRef.current;
    if (wv) {
      const browser = ios ? 'Safari' : 'Chrome';
      return `${baseMsg} Si estás en un navegador interno (WhatsApp, Instagram, Facebook), abre esta página en ${browser} para continuar.`;
    }
    return baseMsg;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!SITE_KEY) {
      setReady(true);
      return;
    }
    let attempts = 0;
    const interval = setInterval(() => {
      if (window.turnstile && containerRef.current) {
        clearInterval(interval);
        setReady(true);
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (t: string) => { setToken(t); setError(null); },
          'expired-callback': () => { setToken(null); if (widgetId.current) window.turnstile?.reset(widgetId.current); },
          'error-callback': () => {
            setToken(null);
            errorCountRef.current += 1;
            if (errorCountRef.current >= MAX_ERROR_TOTAL) {
              setError(buildErrorMessage('La verificación de seguridad no está disponible después de varios intentos. Desactiva tu bloqueador de anuncios o intenta con otro navegador.'));
              return;
            }
            if (errorCountRef.current >= 2 && widgetId.current && window.turnstile) {
              try {
                window.turnstile.remove(widgetId.current);
              } catch {}
              if (!isMountedRef.current) return;
              widgetId.current = window.turnstile.render(containerRef.current!, {
                sitekey: SITE_KEY,
                callback: (t: string) => { setToken(t); setError(null); },
                'expired-callback': () => { setToken(null); if (widgetId.current) window.turnstile?.reset(widgetId.current); },
                appearance: 'interaction-only',
              });
            } else if (widgetId.current && window.turnstile) {
              window.turnstile.reset(widgetId.current);
              window.turnstile.execute(widgetId.current);
            }
          },
          appearance: 'execute',
        });
      }
      if (++attempts > 50) {
        clearInterval(interval);
        setError(buildErrorMessage('No se pudo cargar la verificación de seguridad. Desactiva tu bloqueador de anuncios o intenta con otro navegador.'));
        setReady(true);
      }
    }, 200);
    return () => {
      clearInterval(interval);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [buildErrorMessage]);

  const reset = useCallback(() => {
    setToken(null);
    setError(null);
    errorCountRef.current = 0;
    setReady(false);
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setReady(true), 500);
  }, []);

  return { containerRef, token, ready, reset, error };
}

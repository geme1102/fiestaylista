import { useEffect, useRef, useCallback, useState } from 'react';

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
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return () => {
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
          callback: (t: string) => setToken(t),
          'expired-callback': () => { setToken(null); if (widgetId.current) window.turnstile?.reset(widgetId.current); },
          'error-callback': () => { setToken(null); if (widgetId.current) window.turnstile?.reset(widgetId.current); },
          appearance: 'execute',
        });
      }
      if (++attempts > 50) clearInterval(interval);
    }, 200);
    return () => {
      clearInterval(interval);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setReady(false);
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setReady(true), 100);
  }, []);

  return { containerRef, token, ready, reset };
}

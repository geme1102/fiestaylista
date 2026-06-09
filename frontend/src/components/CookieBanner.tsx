import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type CookiePrefs = {
  essential: true;
  analytics: boolean;
  preferences: boolean;
};

const STORAGE_KEY = 'cookie_consent_v1';

function getStoredPrefs(): CookiePrefs | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && 'essential' in parsed) {
        return parsed as CookiePrefs;
      }
    }
  } catch (err) {
    console.warn('[CookieBanner] Error parsing stored prefs:', err);
  }
  return null;
}

function storePrefs(prefs: CookiePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  applyConsent(prefs);
}

function applyConsent(prefs: CookiePrefs): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('consent', 'update', {
    analytics_storage: prefs.analytics ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: prefs.preferences ? 'granted' : 'denied',
    personalization_storage: prefs.preferences ? 'granted' : 'denied',
    security_storage: 'granted',
  });
}

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [prefs, setPrefs] = useState<CookiePrefs>({ essential: true, analytics: true, preferences: true });
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const existing = getStoredPrefs();
    if (existing) {
      applyConsent(existing);
    } else {
      setPrefs({ essential: true, analytics: false, preferences: false });
      setShowBanner(true);
    }
  }, []);

  const acceptAll = () => {
    const all: CookiePrefs = { essential: true, analytics: true, preferences: true };
    storePrefs(all);
    setPrefs(all);
    animateOut();
  };

  const rejectAll = () => {
    const essential: CookiePrefs = { essential: true, analytics: false, preferences: false };
    storePrefs(essential);
    setPrefs(essential);
    animateOut();
  };

  const saveConfig = () => {
    storePrefs(prefs);
    animateOut();
  };

  const animateOut = () => {
    setLeaving(true);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setShowBanner(false);
      setShowConfig(false);
      setLeaving(false);
    }, 400);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* COOKIE BANNER */}
      {!showConfig && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-fit max-w-4xl z-[60] ${
            leaving ? 'opacity-0 translate-y-4' : 'animate-fade-in'
          } transition-all duration-400`}
          id="cookie-banner"
        >
          <div className="glass p-6 md:p-8 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center gap-6 border-white/40">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[20px]">cookie</span>
                <span className="font-label-md text-caption uppercase tracking-widest">Privacidad</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                Usamos cookies para mejorar tu experiencia.{' '}
                <span className="text-on-surface-variant">We use cookies to improve your experience.</span>
                <Link to="/politica-de-cookies" className="text-primary font-semibold underline underline-offset-4 ml-1 hover:opacity-80 transition-opacity">
                  Más información
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-3 w-full md:w-auto">
              <button onClick={() => setShowConfig(true)} className="px-5 py-3 rounded-xl font-label-md text-primary hover:bg-primary/5 active:scale-95 transition-all">
                Configurar
              </button>
              <button onClick={rejectAll} className="px-5 py-3 rounded-xl font-label-md text-on-surface-variant bg-surface-container-high hover:bg-surface-variant active:scale-95 transition-all">
                Rechazar
              </button>
              <button onClick={acceptAll} className="px-8 py-3 rounded-xl font-label-md text-white primary-gradient glow-shadow-pro active:scale-95 transition-all">
                Aceptar todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURATION OVERLAY */}
      {showConfig && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-6" id="cookie-settings" onKeyDown={(e) => { if (e.key === 'Escape') saveConfig(); }}>
          <div className="absolute inset-0 bg-on-background/40 backdrop-blur-sm" onClick={saveConfig} />
          <div className="relative bg-surface p-8 md:p-10 rounded-[40px] shadow-2xl w-full max-w-lg space-y-8 animate-fade-in border border-outline-variant/30">
            <div className="space-y-2 text-center">
              <h3 className="font-headline-md text-headline-md text-on-surface">Configuración de Privacidad</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Personaliza cómo interactuamos con tus datos para brindarte la mejor experiencia Fiesta y Lista.
              </p>
            </div>
            <div className="space-y-4">
              {/* Esenciales */}
              <label className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-transparent cursor-not-allowed group">
                <div className="space-y-1">
                  <span className="font-label-md text-on-surface block">Cookies Esenciales</span>
                  <span className="text-caption text-on-surface-variant">(Siempre activas)</span>
                </div>
                <input type="checkbox" checked disabled className="w-6 h-6 rounded-lg text-primary-container border-outline-variant opacity-50" />
              </label>
              {/* Analíticas */}
              <label className="flex items-center justify-between p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl hover:border-primary/50 transition-all cursor-pointer group">
                <div className="space-y-1">
                  <span className="font-label-md text-on-surface block">Cookies Analíticas</span>
                  <span className="text-caption text-on-surface-variant">Para entender cómo usas nuestra plataforma.</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                  className="w-6 h-6 rounded-lg text-primary border-outline-variant focus:ring-primary focus:ring-offset-2 cursor-pointer transition-colors"
                />
              </label>
              {/* Preferencias */}
              <label className="flex items-center justify-between p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl hover:border-primary/50 transition-all cursor-pointer group">
                <div className="space-y-1">
                  <span className="font-label-md text-on-surface block">Cookies de Preferencia</span>
                  <span className="text-caption text-on-surface-variant">Recordamos tus selecciones y listas favoritas.</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.preferences}
                  onChange={(e) => setPrefs({ ...prefs, preferences: e.target.checked })}
                  className="w-6 h-6 rounded-lg text-primary border-outline-variant focus:ring-primary focus:ring-offset-2 cursor-pointer transition-colors"
                />
              </label>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={acceptAll} className="w-full py-4 rounded-2xl font-label-md text-white primary-gradient glow-shadow-pro hover:opacity-90 active:scale-[0.98] transition-all">
                Aceptar todas
              </button>
              <button onClick={saveConfig} className="w-full py-4 rounded-2xl font-label-md text-primary border-2 border-primary/20 hover:bg-primary/5 active:scale-[0.98] transition-all">
                Guardar configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

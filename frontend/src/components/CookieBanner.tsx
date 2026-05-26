import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

type CookiePrefs = {
  essential: true;
  analytics: boolean;
  preferences: boolean;
};

const STORAGE_KEY = 'cookie_consent_v1';

function getStoredPrefs(): CookiePrefs | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function storePrefs(prefs: CookiePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [prefs, setPrefs] = useState<CookiePrefs>({ essential: true, analytics: false, preferences: false });

  useEffect(() => {
    const existing = getStoredPrefs();
    if (!existing) {
      setShowBanner(true);
    }
  }, []);

  const acceptAll = () => {
    const all: CookiePrefs = { essential: true, analytics: true, preferences: true };
    storePrefs(all);
    setPrefs(all);
    setShowBanner(false);
    setShowConfig(false);
  };

  const rejectAll = () => {
    const essential: CookiePrefs = { essential: true, analytics: false, preferences: false };
    storePrefs(essential);
    setPrefs(essential);
    setShowBanner(false);
    setShowConfig(false);
  };

  const saveConfig = () => {
    storePrefs(prefs);
    setShowBanner(false);
    setShowConfig(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4">
      <div className="mx-auto max-w-3xl rounded-2xl p-6 shadow-2xl glass-card-premium">
        {!showConfig ? (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Usamos cookies esenciales para el funcionamiento de la plataforma y cookies opcionales para mejorar tu experiencia.
              {/* EN: We use essential cookies for platform functionality and optional cookies to enhance your experience. */}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={acceptAll}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
              >
                Aceptar todas
              </button>
              <button
                onClick={rejectAll}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                Rechazar
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="px-5 py-2.5 text-pink-600 bg-pink-50 dark:bg-pink-900/20 rounded-xl text-sm font-medium hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-all"
              >
                Configurar
              </button>
              <Link to="/politica-de-cookies" className="text-xs text-gray-400 hover:text-pink-600 ml-auto">
                Más información
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Configuración de Cookies
            </p>
            <div className="space-y-3 mb-4">
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Cookies Esenciales</span>
                  <p className="text-xs text-gray-500">Necesarias para el funcionamiento básico</p>
                </div>
                <input type="checkbox" checked={prefs.essential} disabled className="w-4 h-4 accent-pink-500" />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Cookies Analíticas</span>
                  <p className="text-xs text-gray-500">Nos ayudan a mejorar la plataforma</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                  className="w-4 h-4 accent-pink-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Cookies de Preferencias</span>
                  <p className="text-xs text-gray-500">Recuerdan tus configuraciones (idioma, tema)</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.preferences}
                  onChange={(e) => setPrefs({ ...prefs, preferences: e.target.checked })}
                  className="w-4 h-4 accent-pink-500"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={saveConfig}
                className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
              >
                Guardar configuración
              </button>
              <button onClick={acceptAll}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                Aceptar todas
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

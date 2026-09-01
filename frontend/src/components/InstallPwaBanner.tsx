import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMatch);

    const ua = navigator.userAgent;
    setIsIOS(/iPhone|iPad|iPod/.test(ua) && !/Windows Phone/.test(ua));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const handler = () => setDeferredPrompt(null);
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  if (isStandalone) return null;

  if (isIOS && !dismissed) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-primary-container/20 border border-primary/20 flex items-start gap-3 shadow-xl backdrop-blur-xl">
        <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>ios_share</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-primary">Instala Fiesta y Lista</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Toca el botón Compartir <span className="font-semibold">📤</span> y luego <span className="font-semibold">Añadir a pantalla de inicio ➕</span></p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-2 rounded-lg text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-black/5 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    );
  }

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') setDeferredPrompt(null);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-primary-container/20 border border-primary/20 flex items-start gap-3 shadow-xl backdrop-blur-xl">
      <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>install_mobile</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-primary">Instala Fiesta y Lista</p>
        <p className="text-xs text-on-surface-variant mt-0.5">Agrega la app a tu pantalla de inicio para acceder más rápido a tus eventos.</p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 min-h-[44px] flex items-center gap-1.5 shadow-md"
      >
        <span className="material-symbols-outlined text-base">add</span>
        Instalar
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-2 rounded-lg text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-black/5 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Cerrar"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
}

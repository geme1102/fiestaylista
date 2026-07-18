import { useState, useEffect } from 'react';
import { useInAppBrowser, getWebviewOpenHint } from '../hooks/useInAppBrowser';

const DISMISS_KEY = 'webview-banner-dismissed';

export default function WebviewBanner() {
  const { isWebview, browser, isIOS } = useInAppBrowser();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isWebview) return;
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      /* sessionStorage puede estar bloqueado en algunos webviews */
    }
  }, [isWebview]);

  if (!isWebview || dismissed) return null;

  const hint = getWebviewOpenHint(isIOS);
  const browserLabel: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    whatsapp: 'WhatsApp',
    tiktok: 'TikTok',
    twitter: 'X (Twitter)',
    line: 'Line',
    wechat: 'WeChat',
    other: 'el navegador actual',
  };
  const appName = browser ? browserLabel[browser] ?? 'el navegador actual' : 'el navegador actual';

  const handleOpen = () => {
    const currentUrl = window.location.href;
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* noop */
    }
    navigator.clipboard?.writeText(currentUrl).catch(() => {});
    window.location.href = `${hint.href}${currentUrl}`;
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* noop */
    }
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[9999] bg-gradient-to-r from-primary to-brand-pink text-white shadow-lg pt-safe"
    >
      <div className="mx-auto max-w-2xl px-4 pt-safe pb-3">
        <div className="flex items-start gap-3 pt-2">
          <span className="material-symbols-outlined text-xl shrink-0 mt-0.5" aria-hidden="true">
            open_in_new
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">
              Estás en el navegador de {appName}
            </p>
            <p className="text-xs text-white/90 mt-0.5 leading-snug">
              Para una mejor experiencia y evitar problemas de verificación, {hint.label.toLowerCase()}.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleOpen}
                className="bg-white text-primary font-bold text-xs px-4 min-h-[44px] min-w-[100px] rounded-full active:scale-95 transition-transform"
              >
                {hint.label}
              </button>
              <button
                onClick={handleDismiss}
                className="text-white/80 hover:text-white text-xs px-3 min-h-[44px] rounded-full transition-colors"
              >
                Seguir aquí
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Cerrar aviso"
            className="text-white/70 shrink-0 p-2 -mt-1 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}

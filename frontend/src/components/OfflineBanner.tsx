import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-700 text-white animate-banner-slide-down"
    >
      <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium">
        <span className="material-symbols-outlined" aria-hidden="true">wifi_off</span>
        <span>Sin conexión a internet. Algunas funciones no estarán disponibles.</span>
      </div>
    </div>
  );
}
import { useEffect } from 'react';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingSpinner({ fullScreen, size = 'md', text }: LoadingSpinnerProps) {
  useEffect(() => {
    if (!fullScreen) return;
    const original = document.body.style.overflow;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
      window.scrollTo(0, scrollY);
    };
  }, [fullScreen]);

  const spinnerLg = (
    <div className="relative w-20 h-20 mb-8">
      <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
      <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center gift-bounce">
        <span className="material-symbols-outlined text-primary text-4xl" aria-hidden="true">card_giftcard</span>
      </div>
    </div>
  );

  const spinnerMd = (
    <div className="relative w-12 h-12 mb-6">
      <div className="absolute inset-0 border-3 border-secondary-fixed rounded-full" />
      <div className="absolute inset-0 border-3 border-t-secondary rounded-full animate-spin" />
    </div>
  );

  const spinnerSm = (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (fullScreen) {
    return (
      <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-tr from-surface via-primary-container/10 to-surface overflow-hidden">
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/10 blur-[80px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-secondary-container/10 blur-[100px] rounded-full animate-pulse" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative w-32 h-32 mb-12 group">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="absolute -inset-4 border border-primary/10 rounded-full animate-[spin_4s_linear_infinite]" />
            <div className="absolute -inset-8 border border-primary/5 rounded-full animate-[spin_8s_linear_infinite_reverse]" />
            <div className="relative bg-white/40 backdrop-blur-xl border border-white/60 w-full h-full rounded-2xl flex items-center justify-center gift-bounce shadow-2xl">
              <span className="material-symbols-outlined text-primary text-6xl" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>card_giftcard</span>
              <div className="absolute -top-4 -right-4 bg-secondary-container text-white p-2 rounded-full shadow-lg scale-90">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">celebration</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <h2 className="font-headline-md text-headline-md text-primary animate-pulse tracking-wide mb-2">
              {text || 'Cargando momentos especiales...'}
            </h2>
            <div className="flex justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }} />
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }} />
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {size === 'lg' && spinnerLg}
      {size === 'md' && spinnerMd}
      {size === 'sm' && spinnerSm}
      {text && size !== 'sm' && (
        <p className="font-body-md text-body-md text-on-surface-variant animate-pulse text-center">
          {text}
        </p>
      )}
    </div>
  );
}

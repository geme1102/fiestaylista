import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { reportError } from '../../lib/reportError';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface TourStep {
  target: string;
  title: string;
  body: string;
  cta?: string;
  requireClick?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const PADDING = 12;
const MOBILE_NAV_SAFE = 72;
const MIN_CONTENT_HEIGHT = 100;
const TARGET_POLL_MAX_MS = 8000;
const TARGET_POLL_INTERVAL_MS = 100;
const SCROLL_SETTLE_MS = 350;

function measureTarget(selector: string): DOMRect | null {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    return el.getBoundingClientRect();
  } catch (err) {
    reportError(err, { source: 'ProductTour' });
    return null;
  }
}

function smoothScrollToTarget(selector: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const el = document.querySelector(selector);
      if (!el) { resolve(); return; }
      const rect = el.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
      const clampedY = Math.max(0, targetY);
      window.scrollTo({ top: clampedY, behavior: 'smooth' });
    } catch { /* ignore */ }
    setTimeout(resolve, SCROLL_SETTLE_MS);
  });
}

export function ProductTour({
  steps,
  storageKey,
  completed,
  onComplete,
  children,
}: {
  steps: TourStep[];
  storageKey: string;
  completed?: boolean;
  onComplete?: () => void;
  children?: ReactNode;
}) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap(active);

  useEffect(() => {
    if (active && !transitioning) {
      nextButtonRef.current?.focus();
    }
  }, [stepIndex, active, transitioning]);

  const start = useCallback(() => {
    try { if (completed || localStorage.getItem(storageKey) === 'done') return; } catch { return; }
    setActive(true);
    setStepIndex(0);
  }, [storageKey, completed]);

  useEffect(() => {
    const timer = setTimeout(start, 800);
    return () => clearTimeout(timer);
  }, [start]);

  const acquireTarget = useCallback(async (selector: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    let r = measureTarget(selector);
    if (!r) {
      const startTime = Date.now();
      while (Date.now() - startTime < TARGET_POLL_MAX_MS) {
        await new Promise<void>(resolve => {
          pollTimerRef.current = setTimeout(resolve, TARGET_POLL_INTERVAL_MS);
        });
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        r = measureTarget(selector);
        if (r) break;
      }
    }

    if (!r) {
      setRect(null);
      return;
    }

    await smoothScrollToTarget(selector);
    const finalRect = measureTarget(selector);
    setRect(finalRect ?? r);
  }, []);

  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step) return;
    setTransitioning(true);
    setRect(null);
    acquireTarget(step.target).finally(() => setTransitioning(false));
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [active, stepIndex, steps, acquireTarget]);

  const advance = useCallback(() => {
    setTransitioning(true);
    setStepIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step?.requireClick) return;

    const handleClick = (e: Event) => {
      const target = document.querySelector(step.target);
      if (target && (target === e.target || target.contains(e.target as Node))) {
        advance();
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true } as EventListenerOptions);
  }, [active, stepIndex, steps, advance]);

  useEffect(() => {
    if (!active) return;
    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const step = steps[stepIndex];
        if (!step) return;
        const r = measureTarget(step.target);
        if (r) setRect(r);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    let scrollTicking = false;
    const handleScroll = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        handleResize();
        scrollTicking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(resizeTimerRef.current);
    };
  }, [active, stepIndex, steps]);

  useEffect(() => {
    if (!active || stepIndex < steps.length) return;
    try { localStorage.setItem(storageKey, 'done'); } catch {}
    setActive(false);
    onComplete?.();
  }, [active, stepIndex, steps.length, storageKey, onComplete]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const skip = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    try { localStorage.setItem(storageKey, 'done'); } catch {}
    setActive(false);
  }, [storageKey]);

  if (!active) return <>{children}</>;

  const step = steps[stepIndex];
  if (!step) return <>{children}</>;

  const isLast = stepIndex === steps.length - 1;
  const vw = window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const safeBottom = vw < 640 ? MOBILE_NAV_SAFE : PADDING;
  const placement = step.placement ?? 'bottom';

  const tooltipStyle: React.CSSProperties = rect
    ? (() => {
        const spaceBelow = vh - rect.bottom - PADDING - safeBottom;
        const spaceAbove = rect.top - PADDING;

        let finalPlacement = placement;
        if (placement === 'bottom' && spaceBelow < MIN_CONTENT_HEIGHT && spaceAbove >= MIN_CONTENT_HEIGHT) {
          finalPlacement = 'top';
        } else if (placement === 'top' && spaceAbove < MIN_CONTENT_HEIGHT && spaceBelow >= MIN_CONTENT_HEIGHT) {
          finalPlacement = 'bottom';
        }

        const style: React.CSSProperties = { left: rect.left + rect.width / 2 };

        if (finalPlacement === 'top') {
          style.bottom = vh - rect.top + PADDING;
          style.maxHeight = Math.max(MIN_CONTENT_HEIGHT, rect.top - PADDING * 2);
        } else {
          style.top = rect.bottom + PADDING;
          style.maxHeight = Math.max(MIN_CONTENT_HEIGHT, vh - rect.bottom - PADDING - safeBottom);
        }

        style.transform = 'translateX(-50%)';
        return style;
      })()
    : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxHeight: vh - PADDING * 2,
      };

  const cutoutStyle: React.CSSProperties = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
        boxShadow: `0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 ${PADDING}px rgba(255,255,255,0.3)`,
        borderRadius: 16,
      }
    : {};

  return createPortal(
    <div
      ref={trapRef}
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      onKeyDown={(e) => { if (e.key === 'Escape') skip(); }}
    >
      {rect && (
        <div
          className="absolute pointer-events-none transition-all duration-300 ease-out"
          style={cutoutStyle}
        />
      )}
      {!rect && <div className="absolute inset-0 bg-black/60" />}

      <div
        className="absolute z-[101] transition-all duration-300 ease-out"
        style={tooltipStyle}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: transitioning ? 0.3 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto w-[280px] max-w-[calc(100vw-24px)] overflow-y-auto glass-card-premium bg-surface rounded-2xl shadow-2xl p-5 border-2 border-primary/20"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold">
                  {stepIndex + 1}
                </span>
                <h3 className="text-sm font-bold text-on-surface">{step.title}</h3>
              </div>
              <button
                onClick={skip}
                className="text-on-surface-variant/50 hover:text-on-surface transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Cerrar tour"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">{step.body}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-5 bg-primary' : 'w-1.5 bg-outline-variant'}`}
                  />
                ))}
              </div>
              <button
                ref={nextButtonRef}
                onClick={advance}
                disabled={transitioning}
                className="px-4 py-2 min-h-[44px] bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-lg text-xs font-bold hover:shadow-lg transition-shadow disabled:opacity-50"
              >
                {isLast ? '¡Listo!' : step.cta ?? 'Siguiente'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}

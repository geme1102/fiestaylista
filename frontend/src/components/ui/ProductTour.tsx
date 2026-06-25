import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface TourStep {
  target: string;
  title: string;
  body: string;
  cta?: string;
  requireClick?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

function highlightTarget(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  return el.getBoundingClientRect();
}

const PADDING = 8;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT = 180;

export function ProductTour({
  steps,
  storageKey,
  onComplete,
  children,
}: {
  steps: TourStep[];
  storageKey: string;
  onComplete?: () => void;
  children?: ReactNode;
}) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const start = useCallback(() => {
    if (localStorage.getItem(storageKey) === 'done') return;
    setActive(true);
    setStepIndex(0);
  }, [storageKey]);

  useEffect(() => {
    const timer = setTimeout(start, 600);
    return () => clearTimeout(timer);
  }, [start]);

  const updateRect = useCallback((selector: string) => {
    const r = highlightTarget(selector);
    setRect(r);
    if (!r) return;
    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) setRect(el.getBoundingClientRect());
    });
    observerRef.current.observe(document.body, { childList: true, subtree: true });
  }, []);

  const advance = useCallback(() => {
    setWaitingForClick(false);
    setStepIndex((prev) => {
      const next = prev + 1;
      if (next >= steps.length) {
        localStorage.setItem(storageKey, 'done');
        setActive(false);
        onComplete?.();
        return prev;
      }
      return next;
    });
  }, [steps.length, storageKey, onComplete]);

  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step) return;
    updateRect(step.target);
    setWaitingForClick(!!step.requireClick);

    const handleClick = (e: Event) => {
      const target = document.querySelector(step.target);
      if (target && (target === e.target || target.contains(e.target as Node))) {
        advance();
      }
    };

    if (step.requireClick) {
      document.addEventListener('click', handleClick, { capture: true });
      return () => document.removeEventListener('click', handleClick, { capture: true } as EventListenerOptions);
    }
  }, [active, stepIndex, steps, updateRect, advance]);

  useEffect(() => {
    const onResize = () => {
      if (active) updateRect(steps[stepIndex]?.target);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      observerRef.current?.disconnect();
    };
  }, [active, stepIndex, steps, updateRect]);

  const skip = useCallback(() => {
    localStorage.setItem(storageKey, 'done');
    setActive(false);
  }, [storageKey]);

  if (!active) return <>{children}</>;

  const step = steps[stepIndex];
  if (!step) return <>{children}</>;

  const isLast = stepIndex === steps.length - 1;
  const placement = step.placement ?? 'bottom';

  const tooltipStyle: React.CSSProperties = rect
    ? (() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const p = placement;
        let top = 0;
        let left = 0;
        let translateX = '-50%';
        let translateY = '0';

        if (p === 'top') {
          top = rect.top - PADDING - TOOLTIP_HEIGHT;
          left = rect.left + rect.width / 2;
          translateY = '-100%';
          if (top < PADDING) {
            top = rect.bottom + PADDING;
            translateY = '0';
          }
        } else if (p === 'bottom') {
          top = rect.bottom + PADDING;
          left = rect.left + rect.width / 2;
          translateY = '0';
        } else if (p === 'left') {
          top = rect.top + rect.height / 2;
          left = rect.left - PADDING;
          translateX = '-100%';
          translateY = '-50%';
        } else {
          top = rect.top + rect.height / 2;
          left = rect.right + PADDING;
          translateX = '0';
          translateY = '-50%';
        }

        if (p === 'top' || p === 'bottom') {
          if (top + TOOLTIP_HEIGHT > vh - PADDING) {
            top = Math.max(PADDING, vh - TOOLTIP_HEIGHT - PADDING);
          }
          top = Math.max(PADDING, top);
          left = Math.max(TOOLTIP_WIDTH / 2 + PADDING, Math.min(left, vw - TOOLTIP_WIDTH / 2 - PADDING));
        }

        return { top, left, transform: `translate(${translateX}, ${translateY})` };
      })()
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const cutout = rect
    ? {
        boxShadow: `0 0 0 9999px rgba(0,0,0,0.65), 0 0 0 ${PADDING}px rgba(255,255,255,0.4)`,
        borderRadius: 16,
      }
    : {};

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect && (
        <div
          className="absolute pointer-events-none transition-all duration-150"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            ...cutout,
          }}
        />
      )}
      {!rect && <div className="absolute inset-0 bg-black/65" />}

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ type: 'spring', stiffness: 600, damping: 40 }}
          className="absolute z-[101]"
          style={tooltipStyle}
        >
          <div className="w-[280px] glass-card-premium bg-surface rounded-2xl shadow-2xl p-5 border-2 border-primary/20">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold">
                  {stepIndex + 1}
                </span>
                <h3 className="text-sm font-bold text-on-surface">{step.title}</h3>
              </div>
              <button
                onClick={skip}
                className="text-on-surface-variant/50 hover:text-on-surface transition-colors"
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
              {waitingForClick ? (
                <span className="text-xs text-primary font-semibold flex items-center gap-1 animate-pulse">
                  <span className="material-symbols-outlined text-sm">touch_app</span>
                  Haz clic aquí
                </span>
              ) : (
                <button
                  onClick={advance}
                  className="px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-lg text-xs font-bold hover:shadow-lg transition-shadow"
                >
                  {isLast ? '¡Listo! 🎉' : step.cta ?? 'Siguiente'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}

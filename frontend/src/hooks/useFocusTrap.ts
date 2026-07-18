import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(isActive: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const focusablesRef = useRef<HTMLElement[]>([]);

  const updateFocusables = () => {
    if (!ref.current) return;
    focusablesRef.current = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  };

  useEffect(() => {
    if (!isActive || !ref.current) return;

    const container = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Initial capture
    updateFocusables();
    const firstFocusable = focusablesRef.current[0];

    firstFocusable?.focus();

    // MutationObserver for dynamic DOM changes
    observerRef.current = new MutationObserver(() => {
      updateFocusables();
    });
    observerRef.current.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'tabindex'] });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') return;

      if (e.key !== 'Tab') return;

      // Re-read focusables in case they changed
      const currentFocusables = focusablesRef.current;
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isActive]);

  return ref;
}
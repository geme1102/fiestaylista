import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLockedBody } from '../../hooks/useLockedBody';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

export default function Sheet({ open, onClose, children, ariaLabel, className = '' }: SheetProps) {
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useFocusTrap(open);

  useLockedBody(open);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm [overscroll-behavior:contain]"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={shouldReduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 28, stiffness: 300 }}
            className={`relative w-full bg-surface rounded-t-[32px] sm:rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto sm:max-w-lg ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-on-surface-variant/20 rounded-full mx-auto mt-3 mb-2 sm:hidden" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

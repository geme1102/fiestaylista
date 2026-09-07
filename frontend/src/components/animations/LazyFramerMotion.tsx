import { useState, useEffect, type ReactNode } from 'react';

// Wrapper for AnimatePresence that doesn't block initial render
export function LazyAnimatePresence({ children, mode = 'wait' }: { children: ReactNode; mode?: 'wait' | 'popLayout' | 'sync' }) {
  const [FramerMotion, setFramerMotion] = useState<any>(null);

  useEffect(() => {
    import('framer-motion').then((mod) => {
      setFramerMotion(mod);
    });
  }, []);

  if (!FramerMotion) {
    return <>{children}</>; // Render directly without animation while loading
  }

  const { AnimatePresence } = FramerMotion;
  return <AnimatePresence mode={mode}>{children}</AnimatePresence>;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

// Wrapper for page transitions that doesn't block initial render
export function LazyPageTransition({ children }: { children: ReactNode }) {
  const [FramerMotion, setFramerMotion] = useState<any>(null);

  useEffect(() => {
    import('framer-motion').then((mod) => {
      setFramerMotion(mod);
    });
  }, []);

  if (!FramerMotion) {
    return <>{children}</>;
  }
  
  return <InnerTransition FramerMotion={FramerMotion}>{children}</InnerTransition>;
}

function InnerTransition({ FramerMotion, children }: { FramerMotion: any, children: ReactNode }) {
  const { motion, useReducedMotion } = FramerMotion;
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return <>{children}</>;
  }
  
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { PartyPopper } from 'lucide-react';

interface SplashIntroProps {
  onComplete: () => void;
}

export default function SplashIntro({ onComplete }: SplashIntroProps) {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReducedMotion ? 100 : 2300;
    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full flex items-center justify-center z-[9999] select-none"
      style={{
        background: 'linear-gradient(135deg, #8c0053, #d23284, #2f2ebe, #ffb77d, #c0c1ff)'
      }}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ times: [0, 1.8 / 2.3, 1], duration: 2.3, ease: 'easeInOut' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.95, 1, 1, 0.95],
          y: [0, 0, 0, -20]
        }}
        transition={{
          times: [0, 0.5 / 2.3, 1.8 / 2.3, 1],
          duration: 2.3,
          ease: "easeInOut"
        }}
      >
        <div
          className="px-6 sm:px-10 py-4 sm:py-6 rounded-[2.5rem] flex items-center justify-center border-t-white/50 border-l-white/40 border-b-white/10 border-r-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(255,255,255,0.4)] bg-white/15"
          style={{
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)'
          }}
        >
          <PartyPopper className="w-8 h-8 sm:w-10 sm:h-10 mr-3 sm:mr-4 text-white drop-shadow-md flex-shrink-0" />

          <span className="font-sans font-extrabold text-2xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70 drop-shadow-sm tracking-wide whitespace-nowrap">
            Fiesta y Lista
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface LandingHeroProps {
  typedText: string;
  isAuthenticated: boolean;
  onNavigate: (path: string) => void;
}

export function LandingHero({ typedText, isAuthenticated, onNavigate }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden min-h-[calc(100dvh-4rem)] flex flex-col justify-center z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/30 to-surface pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        >
          <h1 className="text-fluid-hero font-extrabold tracking-tight text-on-surface mb-3 font-outfit leading-[1.1]">
            <span className="text-on-surface">La forma más fácil de</span>
            <span className="block relative min-h-[1.3em] mt-1">
              <span className="bg-gradient-to-r from-primary via-primary-container to-secondary-container bg-clip-text text-transparent">
                {typedText}
              </span>
              <span className="animate-typewriter-cursor text-primary font-extralight">|</span>
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-fluid-body text-on-surface-variant mb-8 leading-relaxed">
            Crea tu lista, comparte el enlace por WhatsApp y deja que tus invitados aparten su regalo.
            <br className="hidden sm:block" />
            Sin registros, sin duplicados, sin estrés. Así de simple.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-primary/30 transition-all shadow-lg shadow-primary/20 overflow-hidden"
              >
                <span className="relative z-10">Ir a Mis Eventos</span>
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="relative z-10"
                >
                  →
                </motion.span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-card-shine" />
              </Link>
            ) : (
              <>
                <motion.button
                  onClick={() => onNavigate('/register')}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-lg font-semibold transition-all shadow-lg shadow-primary/20 overflow-hidden animate-pulse-cta"
                >
                  <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/40 to-white/5 pointer-events-none rounded-t-full rounded-b-[100%] opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute inset-0 rounded-full box-border border-t-[1.5px] border-white/60 pointer-events-none mix-blend-overlay"></div>
                  <div className="absolute inset-0 rounded-full box-border border-b-[1.5px] border-black/20 pointer-events-none mix-blend-overlay"></div>
                  <motion.div
                    className="absolute inset-0 w-full h-full z-0 pointer-events-none flex items-center justify-center"
                    initial={{ x: '-150%' }}
                    animate={{ x: '150%' }}
                    transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.5 }}
                  >
                    <div className="w-[50%] h-[200%] bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[30deg] blur-[2px]"></div>
                  </motion.div>
                  <span className="relative z-10">Comenzar mi Lista</span>
                  <span className="text-sm text-white/90 relative z-10">(Gratis y en 2 minutos)</span>
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="relative z-10 text-xl"
                  >
                    →
                  </motion.span>
                </motion.button>
                <Link
                  to="/pricing"
                  className="px-8 py-4 text-on-surface-variant glass-ghost rounded-full text-sm font-semibold hover:shadow-lg transition-all"
                >
                  Ver Planes
                </Link>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 bg-surface/60 text-on-surface-variant shadow-sm">
              <span className="text-amber-500">🔒</span>
              Sin tarjeta de crédito
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 bg-surface/60 text-on-surface-variant shadow-sm">
              <span className="text-amber-500">🎁</span>
              Plan gratis disponible
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 bg-surface/60 text-on-surface-variant shadow-sm">
              <span className="text-amber-500">⚡</span>
              Fácil para todos
            </span>
          </motion.div>

        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-6 h-10 rounded-full border-2 border-outline-variant flex items-start justify-center p-1.5"
        >
          <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" />
        </motion.div>
      </motion.div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface LandingNavbarProps {
  scrolled: boolean;
  isAuthenticated: boolean;
}

export function LandingNavbar({ scrolled, isAuthenticated }: LandingNavbarProps) {
  return (
    <nav className={`sticky top-0 z-50 crystal-nav border-b border-white/20 transition-all duration-300 ${scrolled ? 'shadow-primary/5' : ''}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <picture><source srcSet="/logo.webp" type="image/webp" /><img src="/logo.png" alt="Fiesta y Lista" className="w-[45px] h-[45px] object-contain shrink-0" /></picture>
            <span className="hidden sm:inline text-xl font-bold bg-gradient-to-r from-primary via-primary-container to-secondary-container bg-clip-text text-transparent font-outfit tracking-tight">
              Fiesta y Lista
            </span>
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all duration-300"
              >
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/pricing"
                  className="hidden sm:inline-flex px-4 py-2 text-on-surface-variant text-sm font-semibold hover:text-primary transition-colors"
                >
                  Planes
                </Link>
                <Link
                  to="/login"
                  className="relative hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 text-white rounded-full text-sm font-semibold overflow-hidden group bg-gradient-to-r from-primary to-primary-container shadow-lg shadow-primary/20"
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
                  <span className="relative z-10">Iniciar sesión</span>
                </Link>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Link
                    to="/register"
                    className="relative inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-sm font-semibold overflow-hidden group shadow-lg shadow-primary/20"
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
                    <span className="relative z-10">Crear Lista Gratis</span>
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

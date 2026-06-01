import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect } from 'react';

interface NavbarPremiumProps {
  hideCta?: boolean;
}

export default function NavbarPremium({ hideCta }: NavbarPremiumProps) {
  const { isAuthenticated } = useAuth();
  const { isDark, toggleDark } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 w-full z-50 bg-surface/70 dark:bg-inverse-surface/70 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-rose-500/10 shadow-lg transition-all duration-300 ${
        scrolled ? 'h-16 shadow-md' : 'h-20'
      }`}
    >
      <div className="flex justify-between items-center px-container-margin md:px-section-gap-mobile max-w-full h-full">
        <Link to="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 bg-gradient-to-tr from-primary to-secondary-container rounded-xl flex items-center justify-center text-on-primary font-headline-md shadow-lg shadow-primary/20 transform group-hover:scale-110 transition-transform duration-300">
            F
          </div>
          <span className="font-headline-md text-headline-md font-extrabold text-on-surface dark:text-inverse-on-surface hidden sm:block">
            Fiesta y Lista
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleDark}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            <span className="material-symbols-outlined block dark:hidden text-on-surface-variant">
              dark_mode
            </span>
            <span className="material-symbols-outlined hidden dark:block text-primary-fixed-dim">
              light_mode
            </span>
          </button>

          {!hideCta && (
            <>
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <Link
                    to="/dashboard"
                    className="relative overflow-hidden bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full text-label-md font-label-md shadow-lg shadow-rose-500/20 active:scale-95 transition-all duration-200"
                  >
                    <span className="relative z-10">Ir al Dashboard</span>
                    <div className="absolute inset-0 shimmer" />
                  </Link>
                  <div className="hidden md:flex items-center gap-3 pl-4 border-l border-outline/20">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                      <span className="material-symbols-outlined text-primary">person</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link
                    to="/login"
                    className="hidden md:inline-flex text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors px-4 py-2"
                  >
                    Entrar a mi Evento
                  </Link>
                  <Link
                    to="/register"
                    className="relative overflow-hidden bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full text-label-md font-label-md shadow-lg shadow-rose-500/20 active:scale-95 transition-all duration-200"
                  >
                    <span className="relative z-10">Crear Lista Gratis</span>
                    <div className="absolute inset-0 shimmer" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

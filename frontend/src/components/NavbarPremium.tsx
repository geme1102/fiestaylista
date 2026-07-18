import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import Logo from './Logo';

interface NavbarPremiumProps {
  hideCta?: boolean;
}

export default function NavbarPremium({ hideCta }: NavbarPremiumProps) {
  const { isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-testid="navbar"
      className={`sticky top-0 w-full z-50 crystal-nav border-b border-white/20 transition-all duration-300 h-16 pt-safe ${
        scrolled ? 'shadow-md' : ''
      }`}
    >
      <div className={`flex justify-between items-center px-container-margin md:px-section-gap-mobile max-w-full h-full transition-all duration-300 ${scrolled ? 'py-2' : 'py-4'}`}>
        <Link to="/" aria-label="Ir al inicio" className="flex items-center gap-3 group cursor-pointer">
<Logo className="w-[45px] h-[45px] transition-transform group-hover:scale-105" />
          <span className="font-headline-md text-headline-md font-extrabold text-on-surface hidden sm:block">
            Fiesta y Lista
          </span>
        </Link>

        <div className="flex items-center gap-4">

                    {!hideCta && (
            <>
              {isAuthenticated ? (
                <div className="flex items-center gap-2 sm:gap-4">
                  <button
                    type="button"
                    data-testid="logout-button"
                    onClick={logout}
                    className="hidden sm:inline-flex items-center min-h-[44px] text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors px-4 py-2 border border-outline/30 rounded-full"
                  >
                    Cerrar Sesión
                  </button>
                  <button
                    type="button"
                    data-testid="logout-button-mobile"
                    onClick={logout}
                    className="sm:hidden inline-flex items-center min-h-[44px] text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors px-3 py-2 border border-outline/30 rounded-full"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                  </button>
                  <Link
                    to="/dashboard"
                    data-testid="dashboard-link"
                    className="bg-primary/10 text-primary px-4 sm:px-6 py-2.5 rounded-full text-label-md font-label-md hover:bg-primary/20 active:scale-95 transition-all duration-200 whitespace-nowrap"
                  >
                    Dashboard
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-4">
                  <Link
                    to="/login"
                    className="hidden sm:inline-block text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors px-4 py-2"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/login"
                    className="sm:hidden inline-block text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors px-3 py-2"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    className="hidden sm:inline-flex relative overflow-hidden bg-gradient-to-r from-primary to-secondary-container text-on-primary px-4 sm:px-6 py-2.5 rounded-full text-label-md font-label-md shadow-lg shadow-rose-500/20 active:scale-95 transition-all duration-200 whitespace-nowrap"
                  >
                    <span className="relative z-10">Crear Lista Gratis</span>
                    <div className="absolute inset-0 animate-shimmer" />
                  </Link>
                  <Link
                    to="/register"
                    className="sm:hidden inline-flex relative overflow-hidden bg-gradient-to-r from-primary to-secondary-container text-on-primary px-4 py-2.5 rounded-full text-label-md font-label-md shadow-lg shadow-rose-500/20 active:scale-95 transition-all duration-200 whitespace-nowrap"
                  >
                    <span className="relative z-10">Crear Lista Gratis</span>
                    <div className="absolute inset-0 animate-shimmer" />
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

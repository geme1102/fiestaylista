import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

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
      className={`sticky top-0 w-full z-50 bg-surface/70 backdrop-blur-xl border-b border-white/20 shadow-rose-500/10 shadow-lg transition-all duration-300 ${
        scrolled ? 'h-16 shadow-md' : 'h-20'
      }`}
    >
      <div className="flex justify-between items-center px-container-margin md:px-section-gap-mobile max-w-full h-full">
        <Link to="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 bg-gradient-to-tr from-primary to-secondary-container rounded-xl flex items-center justify-center text-on-primary font-headline-md shadow-lg shadow-primary/20 transform group-hover:scale-110 transition-transform duration-300">
            F
          </div>
          <span className="font-headline-md text-headline-md font-extrabold text-on-surface hidden sm:block">
            Fiesta y Lista
          </span>
        </Link>

        <div className="flex items-center gap-4">

                    {!hideCta && (
            <>
              {isAuthenticated ? (
                <div className="hidden md:flex items-center gap-4">
                  <button
                    onClick={logout}
                    className="text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors px-4 py-2 border border-outline/30 rounded-full"
                  >
                    Cerrar Sesión
                  </button>
                  <div className="flex items-center gap-3 pl-4 border-l border-outline/20">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                      <span className="material-symbols-outlined text-primary">person</span>
                    </div>
                    <Link
                      to="/dashboard"
                      className="bg-primary/10 text-primary px-6 py-2.5 rounded-full text-label-md font-label-md hover:bg-primary/20 active:scale-95 transition-all duration-200"
                    >
                      Ir al Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-4">
                  <Link
                    to="/login"
                    className="text-label-md font-label-md text-on-surface-variant hover:text-primary transition-colors px-4 py-2"
                  >
                    Entrar a mi Evento
                  </Link>
                  <Link
                    to="/register"
                    className="relative overflow-hidden bg-gradient-to-r from-primary to-secondary-container text-on-primary px-6 py-2.5 rounded-full text-label-md font-label-md shadow-lg shadow-rose-500/20 active:scale-95 transition-all duration-200"
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

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface NavbarPremiumProps {
  hideCta?: boolean;
}

export default function NavbarPremium({ hideCta }: NavbarPremiumProps) {
  const { isAuthenticated } = useAuth();
  const { isDark, toggleDark } = useTheme();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-[#0B0F19]/60 border-b border-white/20 dark:border-white/10 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-rose-500/25 group-hover:shadow-rose-500/40 transition-all duration-300">
              F
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent font-outfit tracking-tight">
              Fiesta y Lista
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDark}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            {!hideCta && (
              <>
                {isAuthenticated ? (
                  <Link
                    to="/dashboard"
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all duration-300"
                  >
                    Ir al Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                    >
                      Entrar a mi Evento
                    </Link>
                    <Link
                      to="/register"
                      className="relative inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-full text-sm font-semibold overflow-hidden group shadow-lg shadow-rose-500/20"
                    >
                      <span className="relative z-10">Crear Lista Gratis</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-card-shine" />
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';
import { cn } from '../utils/cn';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Mis Eventos', icon: '🏠' },
  { path: '/pricing', label: 'Planes', icon: '💎' },
  { path: '/account', label: 'Mi Cuenta', icon: '👤' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleDark } = useTheme();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors pb-16 sm:pb-0">
      <nav className="sticky top-0 z-50 glass-card border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
                <span className="text-2xl">🎉</span>
                <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                  Fiesta y Lista
                </span>
              </Link>
              <div className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center',
                      pathname === item.path
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800',
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleDark}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Cambiar tema"
              >
                {isDark ? '☀️' : '🌙'}
              </button>

              <span className="hidden sm:block text-sm text-gray-600 dark:text-gray-400">
                {user?.name}
              </span>

              <button
                onClick={logout}
                className="hidden sm:inline-flex items-center px-4 py-2 min-h-[44px] text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Salir
              </button>

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Menú"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'block px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                    pathname === item.path
                      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800',
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="w-full text-left px-4 py-3 min-h-[44px] text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="hidden sm:block border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
            <p>© {new Date().getFullYear()} Diego Alejandro Fierro Rivera. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <Link to="/terminos-y-condiciones" className="hover:text-pink-600 dark:hover:text-pink-400 transition-colors">Términos</Link>
              <Link to="/politica-de-privacidad" className="hover:text-pink-600 dark:hover:text-pink-400 transition-colors">Privacidad</Link>
              <Link to="/politica-de-cookies" className="hover:text-pink-600 dark:hover:text-pink-400 transition-colors">Cookies</Link>
              <Link to="/derechos-arco" className="hover:text-pink-600 dark:hover:text-pink-400 transition-colors">ARCO</Link>
            </div>
          </div>
        </div>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[44px] text-xs font-medium transition-colors',
                pathname === item.path
                  ? 'text-pink-600 dark:text-pink-400'
                  : 'text-gray-500 dark:text-gray-400',
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

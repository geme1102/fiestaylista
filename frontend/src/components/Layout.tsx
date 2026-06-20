import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMemo, useState } from 'react';
import { cn } from '../utils/cn';

const BASE_NAV_ITEMS = [
  { path: '/dashboard', label: 'Mis Eventos', icon: 'celebration' },
  { path: '/pricing', label: 'Planes', icon: 'auto_awesome' },
  { path: '/account', label: 'Mi Cuenta', icon: 'person' },
];

function useNavItems(tier: string | undefined) {
  return useMemo(() => {
    if (tier === 'pro') {
      return [
        ...BASE_NAV_ITEMS.slice(0, 1),
        { path: '/statistics', label: 'Estadísticas', icon: 'bar_chart' },
        ...BASE_NAV_ITEMS.slice(1),
      ];
    }
    return BASE_NAV_ITEMS;
  }, [tier]);
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const NAV_ITEMS = useNavItems(user?.tier);

  return (
    <div className="min-h-screen bg-surface transition-colors pb-safe sm:pb-0">
      {/* Skip to main content link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-lg focus:outline-2 focus:outline-offset-2 focus:outline-primary">
        Saltar al contenido principal
      </a>
      <nav className="sticky top-0 z-50 crystal-nav border-b border-white/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
<picture><source srcSet="/logo.webp" type="image/webp" /><img src="/logo.png" alt="Fiesta y Lista" className="w-[45px] h-[45px] object-contain" /></picture>
                <span className="text-xl font-bold bg-gradient-to-r from-primary via-primary-container to-secondary-container bg-clip-text text-transparent font-outfit">
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
                        ? 'bg-primary/10 text-primary'
                        : 'text-on-surface-variant hover:text-primary hover:bg-black/5'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="hidden md:inline-flex bg-primary-container text-on-primary-container px-6 py-2 rounded-full font-label-md text-label-md shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                Crear Evento
              </Link>
              <span className="hidden sm:block text-sm text-on-surface-variant">
                {user?.name}
              </span>

              <button
                onClick={logout}
                className="hidden sm:inline-flex items-center px-4 py-2 min-h-[44px] text-sm font-medium text-error hover:bg-error-container/20 rounded-lg transition-colors"
              >
                Salir
              </button>

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-black/5"
                aria-label="Menú"
              >
                <span className="material-symbols-outlined">
                  {mobileOpen ? 'close' : 'menu'}
                </span>
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="md:hidden border-t border-outline/20 py-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                    pathname === item.path
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:text-primary hover:bg-black/5'
                  )}
                >
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium text-error hover:bg-error-container/20 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Salir
              </button>
            </div>
          )}
        </div>
      </nav>

      <main id="main-content" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-10 pb-24 sm:pb-10">
        <Outlet />
      </main>

      <footer className="border-t border-outline-variant/30 bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
            <p>© {new Date().getFullYear()} fiestaylista.com. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <Link to="/terminos-y-condiciones" className="hover:text-primary transition-colors">Términos</Link>
              <Link to="/politica-de-privacidad" className="hover:text-primary transition-colors">Privacidad</Link>
              <Link to="/politica-de-cookies" className="hover:text-primary transition-colors">Cookies</Link>
              <Link to="/derechos-arco" className="hover:text-primary transition-colors">ARCO</Link>
            </div>
          </div>
        </div>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden crystal-nav border-t border-white/20 shadow-[0_-4px_20px_rgba(177,14,107,0.1)] pb-safe rounded-t-xl">
        <div className="flex items-center justify-around h-16 px-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[44px] text-xs font-medium transition-all duration-200 relative',
                pathname === item.path
                  ? 'text-primary after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full'
                  : 'text-on-surface-variant/60 hover:text-primary',
              )}
            >
              <span className={cn(
                'material-symbols-outlined text-lg',
                pathname === item.path ? '' : '',
              )}
                style={pathname === item.path ? { fontVariationSettings: '"FILL" 1' } : undefined}>
                {item.icon}
              </span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

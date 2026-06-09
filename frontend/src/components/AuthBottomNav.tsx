import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Inicio', icon: 'home' },
  { path: '/pricing', label: 'Planes', icon: 'card_giftcard' },
  { path: '/login', label: 'Entrar', icon: 'login' },
  { path: '/register', label: 'Registro', icon: 'person_add' },
];

export default function AuthBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-surface/70 backdrop-blur-2xl border-t border-white/20 shadow-[0_-4px_20px_rgba(177,14,107,0.1)] pb-[env(safe-area-inset-bottom,0px)] rounded-t-xl">
      <div className="flex items-center justify-around h-16 px-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[44px] text-xs font-medium transition-all duration-200 relative ${
                isActive
                  ? 'text-primary after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full'
                  : 'text-on-surface-variant/60 hover:text-primary'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={isActive ? { fontVariationSettings: '"FILL" 1' } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

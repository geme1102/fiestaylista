import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex flex-col font-body-md text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed overflow-x-hidden"
      style={{ backgroundColor: '#faf9f8',
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(210, 50, 132, 0.15) 0px, transparent 50%),
          radial-gradient(at 100% 0%, rgba(254, 147, 44, 0.1) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(177, 14, 107, 0.1) 0px, transparent 50%),
          radial-gradient(at 0% 100%, rgba(210, 50, 132, 0.05) 0px, transparent 50%)
        `
      }}
    >
      {/* Brand Nav */}
      <nav className="absolute top-0 w-full flex items-center justify-center h-20 px-container-margin z-50">
        <span className="font-headline-md text-headline-md text-primary tracking-tight">Fiesta y Lista</span>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-container-margin py-20 relative">
        <div className="absolute top-1/4 left-10 w-32 h-32 bg-primary-container/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-10 w-48 h-48 bg-secondary-container/10 rounded-full blur-3xl" />
        <div className="max-w-2xl w-full text-center space-y-12 relative z-10">
          <div className="flex justify-center">
            <div
              className="glass-card p-10 rounded-3xl shadow-rose-500/10 shadow-2xl inline-flex items-center justify-center relative group animate-float"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="material-symbols-outlined text-8xl md:text-9xl text-primary drop-shadow-sm select-none relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="font-display-lg text-display-lg text-primary tracking-tighter sm:text-7xl md:text-8xl">
              404
            </h1>
            <p className="font-headline-lg text-headline-lg text-on-surface-variant">
              Página no encontrada
            </p>
            <p className="font-body-lg text-body-lg text-outline max-w-md mx-auto">
              Parece que el regalo que buscabas no está en esta lista. No te preocupes, ¡la celebración continúa!
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link
              to={isAuthenticated ? '/dashboard' : '/'}
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-md text-label-md rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
            >
              {isAuthenticated ? 'Ir al Dashboard' : 'Volver al inicio'}
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-16 max-w-lg mx-auto">
            <Link to="/pricing" className="glass-card p-6 rounded-2xl text-left flex items-start gap-4 hover:bg-white/60 transition-all duration-300 group border border-white/40">
              <span className="material-symbols-outlined text-primary p-2 bg-primary/5 rounded-lg group-hover:scale-110 transition-transform">featured_seasonal_and_gifts</span>
              <div>
                <span className="font-label-md text-label-md text-on-surface block">Planes</span>
                <span className="text-caption text-outline">Conoce nuestros planes y precios.</span>
              </div>
            </Link>
            <Link to="/" className="glass-card p-6 rounded-2xl text-left flex items-start gap-4 hover:bg-white/60 transition-all duration-300 group border border-white/40">
              <span className="material-symbols-outlined text-secondary p-2 bg-secondary/5 rounded-lg group-hover:scale-110 transition-transform">home</span>
              <div>
                <span className="font-label-md text-label-md text-on-surface block">Inicio</span>
                <span className="text-caption text-outline">Volver al inicio de Fiesta y Lista</span>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-caption text-outline-variant">
        © {new Date().getFullYear()} Fiesta y Lista. Elevando tus celebraciones.
      </footer>
    </div>
    </>
  );
}

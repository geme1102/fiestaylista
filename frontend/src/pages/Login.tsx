import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';
import NavbarPremium from '../components/NavbarPremium';
import AuthBottomNav from '../components/AuthBottomNav';

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Completa todos los campos', 'error');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al iniciar sesión', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión - Fiesta y Lista</title>
        <meta name="description" content="Inicia sesión en Fiesta y Lista para administrar tus listas de regalos y eventos. Accede a tu cuenta y organiza baby showers, bodas y cumpleaños." />
        <meta name="keywords" content="fiestaylista, iniciar sesión, lista de regalos, acceder cuenta" />
        <meta property="og:title" content="Iniciar Sesión - Fiesta y Lista" />
        <meta property="og:description" content="Inicia sesión en Fiesta y Lista para administrar tus listas de regalos." />
        <meta name="twitter:title" content="Iniciar Sesión - Fiesta y Lista" />
        <meta name="twitter:description" content="Inicia sesión en Fiesta y Lista." />
      </Helmet>
      <div className="min-h-screen bg-[#FAF9F8] pb-24 sm:pb-0">
        <NavbarPremium />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-primary/25">
                  F
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary via-primary-container to-secondary-container bg-clip-text text-transparent font-outfit">
                  Fiesta y Lista
                </span>
              </Link>
              <h1 className="text-2xl font-bold text-on-surface font-outfit">Iniciar Sesión</h1>
              <p className="text-on-surface-variant mt-1">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="text-primary hover:text-primary-fixed-dim font-medium">
                  Regístrate
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="backdrop-blur-md bg-white/70 border border-white/20 rounded-2xl p-8 space-y-5 shadow-sm">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="tu@correo.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <div className="text-right mt-1">
                  <Link to="/forgot-password" className="text-sm text-primary hover:text-primary-fixed-dim font-medium">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[44px]"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <AuthBottomNav />
    </>
  );
}

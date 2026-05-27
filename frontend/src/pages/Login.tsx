import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';

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
        <meta property="og:title" content="Iniciar Sesión - Fiesta y Lista" />
        <meta name="twitter:title" content="Iniciar Sesión - Fiesta y Lista" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-3xl">🎉</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
              Fiesta y Lista
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Iniciar Sesión</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-pink-600 hover:text-pink-700 dark:text-pink-400 font-medium">
              Regístrate
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
              placeholder="tu@correo.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <div className="text-right mt-1">
              <Link to="/forgot-password" className="text-sm text-pink-600 hover:text-pink-700 dark:text-pink-400 font-medium">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
      </div>
    </>
  );
}

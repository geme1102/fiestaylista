import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Ingresa tu correo electrónico', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al enviar correo', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Recuperar Contraseña - Fiesta y Lista</title>
        <meta property="og:title" content="Recuperar Contraseña - Fiesta y Lista" />
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recuperar Contraseña</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Te enviaremos un enlace para restablecer tu contraseña
            </p>
          </div>

          {sent ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <span className="text-5xl mb-4 block">📧</span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Revisa tu bandeja de entrada</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Si existe una cuenta con <strong className="text-gray-700 dark:text-gray-300">{email}</strong>,
                recibirás un enlace para restablecer tu contraseña en unos minutos.
              </p>
              <Link
                to="/login"
                className="inline-flex px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
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
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Enviar enlace'}
              </button>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-pink-600 hover:text-pink-700 dark:text-pink-400 font-medium">
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

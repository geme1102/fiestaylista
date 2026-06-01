import { useState } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(pw)) return 'Debe contener al menos una mayúscula';
    if (!/[0-9]/.test(pw)) return 'Debe contener al menos un número';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) {
      showToast(pwError, 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/auth/reset-password', { token, password });
      setDone(true);
      showToast('Contraseña actualizada correctamente', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al restablecer contraseña', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-fixed/10 via-surface to-surface dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
        <div className="w-full max-w-md text-center">
          <span className="text-5xl mb-4 block">✅</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Contraseña actualizada</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Tu contraseña se ha restablecido correctamente.</p>
          <Link
            to="/login"
            className="inline-flex px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Nueva Contraseña - Fiesta y Lista</title>
        <meta property="og:title" content="Nueva Contraseña - Fiesta y Lista" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-fixed/10 via-surface to-surface dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6" aria-label="Ir al inicio">
              <span className="text-3xl" aria-hidden="true">🎉</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
                Fiesta y Lista
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva Contraseña</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Ingresa tu nueva contraseña</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="Repite la contraseña"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Restablecer contraseña'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

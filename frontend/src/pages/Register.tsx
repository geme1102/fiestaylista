import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Register() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      showToast('Completa todos los campos', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showToast('La contraseña debe contener al menos una mayúscula', 'error');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showToast('La contraseña debe contener al menos un número', 'error');
      return;
    }
    if (!acceptTerms || !acceptPrivacy) {
      showToast('Debes aceptar los términos y la política de privacidad', 'error');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al registrarse', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <Helmet>
        <title>Registrarse - Fiesta y Lista</title>
        <meta property="og:title" content="Registrarse - Fiesta y Lista" />
        <meta name="twitter:title" content="Registrarse - Fiesta y Lista" />
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crear Cuenta</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-pink-600 hover:text-pink-700 dark:text-pink-400 font-medium">
              Inicia Sesión
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
              placeholder="Tu nombre"
              autoComplete="name"
            />
          </div>

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
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 accent-pink-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Acepto los{' '}
                <Link to="/terminos-y-condiciones" target="_blank" className="text-pink-600 hover:underline">Términos y Condiciones</Link>
                {' '}y confirmo que soy mayor de 14 años.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                className="mt-1 w-4 h-4 accent-pink-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Acepto la{' '}
                <Link to="/politica-de-privacidad" target="_blank" className="text-pink-600 hover:underline">Política de Privacidad</Link>
                {' '}y el tratamiento de mis datos personales según la Ley 1581 de 2012.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !acceptTerms || !acceptPrivacy}
            className="w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Crear Cuenta'}
          </button>
        </form>
      </div>
      </div>
    </>
  );
}

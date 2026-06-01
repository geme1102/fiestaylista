import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';
import NavbarPremium from '../components/NavbarPremium';

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Débil', color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Media', color: 'bg-amber-500' };
  return { score, label: 'Fuerte', color: 'bg-green-500' };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label, color } = getPasswordStrength(password);
  const pct = (score / 5) * 100;
  return (
    <div className="flex items-center gap-3" aria-label={`Fortaleza de contraseña: ${label}`}>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${color.replace('bg-', 'text-')}`}>{label}</span>
    </div>
  );
}

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
      <div className="min-h-screen bg-[#FAF9F8] dark:bg-[#0B0F19]">
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-outfit">Crear Cuenta</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-primary hover:text-primary-fixed-dim dark:text-primary-fixed-dim font-medium">
                  Inicia Sesión
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="backdrop-blur-md bg-white/70 dark:bg-[#0B0F19]/60 border border-white/20 dark:border-white/10 rounded-2xl p-8 space-y-5 shadow-sm">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nombre
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                {password && (
                  <div className="mt-2">
                    <PasswordStrengthBar password={password} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-primary"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Acepto los{' '}
                    <Link to="/terminos-y-condiciones" target="_blank" className="text-primary hover:underline">Términos y Condiciones</Link>
                    {' '}y confirmo que soy mayor de 14 años.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-primary"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Acepto la{' '}
                    <Link to="/politica-de-privacidad" target="_blank" className="text-primary hover:underline">Política de Privacidad</Link>
                    {' '}y el tratamiento de mis datos personales según la Ley 1581 de 2012.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !acceptTerms || !acceptPrivacy}
                className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Crear Cuenta'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

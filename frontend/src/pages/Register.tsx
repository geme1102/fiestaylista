import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';
import NavbarPremium from '../components/NavbarPremium';
import AuthBottomNav from '../components/AuthBottomNav';

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
      <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
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
        <meta name="description" content="Crea tu cuenta gratis en Fiesta y Lista y empieza a organizar listas de regalos para baby showers, bodas y cumpleaños en 2 minutos. Sin tarjeta de crédito." />
        <meta name="keywords" content="fiestaylista, registrarse, crear cuenta, lista de regalos gratis" />
        <meta property="og:title" content="Registrarse - Fiesta y Lista" />
        <meta property="og:description" content="Crea tu cuenta gratis en Fiesta y Lista. Organiza listas de regalos en 2 minutos." />
        <meta name="twitter:title" content="Registrarse - Fiesta y Lista" />
        <meta name="twitter:description" content="Crea tu cuenta gratis en Fiesta y Lista." />
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
              <h1 className="text-2xl font-bold text-on-surface font-outfit">Crear Cuenta</h1>
              <p className="text-on-surface-variant mt-1">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-primary hover:text-primary-fixed-dim font-medium">
                  Inicia Sesión
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="backdrop-blur-md bg-white/70 border border-white/20 rounded-2xl p-8 space-y-5 shadow-sm">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                  Nombre
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
              </div>

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
                    id="accept-terms"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-primary"
                  />
                  <span className="text-xs text-on-surface-variant">
                    Acepto los{' '}
                    <Link to="/terminos-y-condiciones" target="_blank" className="text-primary hover:underline">Términos y Condiciones</Link>
                    {' '}y confirmo que soy mayor de 14 años.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="accept-privacy"
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-primary"
                  />
                  <span className="text-xs text-on-surface-variant">
                    Acepto la{' '}
                    <Link to="/politica-de-privacidad" target="_blank" className="text-primary hover:underline">Política de Privacidad</Link>
                    {' '}y el tratamiento de mis datos personales según la Ley 1581 de 2012.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !acceptTerms || !acceptPrivacy}
                className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[44px]"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Crear Cuenta'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <AuthBottomNav />
    </>
  );
}

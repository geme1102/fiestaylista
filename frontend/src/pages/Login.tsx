import { useState, useRef, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import LoadingSpinner from '../components/LoadingSpinner';
import NavbarPremium from '../components/NavbarPremium';
import Logo from '../components/Logo';
import AuthBottomNav from '../components/AuthBottomNav';

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigatedRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFormValid = email.length > 0 && password.length > 0;

  const { containerRef, token: turnstileToken, error: turnstileError } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  useEffect(() => { return () => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); }; }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      showToast('Completa todos los campos', 'error');
      return;
    }

    let token = turnstileToken;
    if (!token) {
      token = await waitForTurnstile(() => turnstileTokenRef.current);
    }

    setLoading(true);
    safetyTimerRef.current = setTimeout(() => {
      setLoading(false);
      showToast('El servicio está tardando más de lo esperado. Intenta de nuevo.', 'info');
    }, 15000);

    try {
      const res = await login(email, password, token ?? undefined);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      navigatedRef.current = true;
      if (res.user && !res.user.emailVerified) {
        showToast('Inicio de sesión exitoso. Tu correo aún no está verificado — revisa tu bandeja de entrada.', 'info');
      }
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect) {
        try {
          const url = new URL(redirect, window.location.origin);
          if (url.origin === window.location.origin) {
            navigate(url.pathname + url.search, { replace: true });
            return;
          }
        } catch (err) { reportError(err, { source: 'Login' }); }
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      reportError(err, { source: 'Login' });
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Credenciales inválidas')) {
        showToast('Credenciales inválidas. Verifica tu correo y contraseña e intenta de nuevo.', 'error');
      } else if (msg) {
        showToast(msg, 'error');
      } else {
        showToast('Error al iniciar sesión. Intenta de nuevo.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated && !navigatedRef.current) return <Navigate to="/dashboard" replace />;

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
      <main className="min-h-screen bg-surface pb-24 sm:pb-0">
        <NavbarPremium />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <Link to="/" aria-label="Ir al inicio" className="inline-flex items-center gap-2 mb-6 group">
<Logo className="w-9 h-9 transition-transform group-hover:scale-105" />
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

            <form onSubmit={handleSubmit} className="backdrop-blur-md bg-surface/70 border border-white/20 rounded-2xl p-8 space-y-5 shadow-sm">
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
                  inputMode="email"
                  enterKeyHint="next"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    enterKeyHint="go"
                  />
                  <button
                    type="button"
                    data-testid="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="text-right mt-1">
                  <Link to="/forgot-password" className="text-sm text-primary hover:text-primary-fixed-dim font-medium">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isFormValid}
                aria-busy={loading}
                className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold hover:shadow-lg hover:shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[44px]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Iniciando sesión...
                  </span>
                ) : 'Iniciar Sesión'}
              </button>
            </form>

            {turnstileError && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/60 text-sm text-amber-800 mt-6">
                <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">shield_person</span>
                <div className="space-y-1">
                  <p className="font-medium">Verificación de seguridad no disponible</p>
                  <p className="text-amber-700/80">{turnstileError}</p>
                </div>
              </div>
            )}
            <div ref={containerRef} className="absolute -z-10 opacity-0" />
          </div>
        </div>
      </main>
      <AuthBottomNav />
    </>
  );
}

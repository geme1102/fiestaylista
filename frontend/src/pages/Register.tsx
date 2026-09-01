import { useState, useRef, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import LoadingSpinner from '../components/LoadingSpinner';
import { Button } from '../components/ui/Button';
import NavbarPremium from '../components/NavbarPremium';
import Logo from '../components/Logo';
import AuthBottomNav from '../components/AuthBottomNav';
import { getPasswordStrength } from '../utils/passwordStrength';

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label, color, textColor } = getPasswordStrength(password);
  const pct = (score / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden"
        role="progressbar"
        aria-label={`Fortaleza de contraseña: ${label}`}
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={5}
      >
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${textColor}`}>{label}</span>
    </div>
  );
}

export default function Register() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const navigatedRef = useRef(false);
  const submittingRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const params = new URLSearchParams(location.search);
  const planParam = params.get('plan');
  const intervalParam = params.get('interval');

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const { containerRef, token: turnstileToken, reset: resetTurnstile } = useTurnstile();
  const isFormValid = name.length > 0 && email.length > 0 && password.length >= 8
    && /[A-Z]/.test(password) && /[0-9]/.test(password) && acceptTerms && acceptPrivacy
    && (!!turnstileToken || !import.meta.env.VITE_TURNSTILE_SITE_KEY);

  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  useEffect(() => { return () => { if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current); }; }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submittingRef.current) return;

    // B3: validaciones ANTES de setear el flag — un early-return con el flag
    // activo dejaba el formulario permanentemente muerto (Enter con campos vacíos).
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

    submittingRef.current = true;
    setLoading(true);
    setRateLimited(false);

    try {
      let token = turnstileToken;
      if (!token) {
        token = await waitForTurnstile(() => turnstileTokenRef.current);
      }
      if (!token && import.meta.env.VITE_TURNSTILE_SITE_KEY) {
        setLoading(false);
        showToast('Verificación de seguridad pendiente. Intenta de nuevo en un momento.', 'info');
        resetTurnstile();
        return;
      }

      safetyTimerRef.current = setTimeout(() => {
        setLoading(false);
        showToast('El servicio está tardando más de lo esperado. Intenta de nuevo.', 'info');
      }, 15000);

      await register(email, password, name, token ?? undefined);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      navigatedRef.current = true;
      if (planParam === 'pro' || planParam === 'pro_plus') {
        navigate(`/pricing?interval=${intervalParam || 'month'}`, { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch (err) {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      resetTurnstile();
      reportError(err, { source: 'Register' });
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Demasiados')) {
        setRateLimited(true);
      }
      showToast(msg || 'Error al crear tu cuenta. Verifica tus datos e intenta de nuevo.', 'error');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated && !navigatedRef.current) return <Navigate to="/dashboard" replace />;

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
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-surface pb-24 sm:pb-0">
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
              <h1 className="text-2xl font-bold text-on-surface font-outfit">Crear Cuenta</h1>
              <p className="text-on-surface-variant mt-1">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-primary hover:text-primary-fixed-dim font-medium">
                  Inicia Sesión
                </Link>
              </p>
              <p className="text-xs text-on-surface-variant mt-2">Sin tarjeta de crédito. En 2 minutos tendrás tu lista lista.</p>
            </div>

            <form onSubmit={handleSubmit} className="relative backdrop-blur-md bg-surface/70 border border-white/20 rounded-2xl p-8 space-y-5 shadow-sm">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                  Nombre
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="Tu nombre"
                  autoComplete="name"
                  inputMode="text"
                  autoCapitalize="words"
                  enterKeyHint="next"
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
                  maxLength={254}
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
                    maxLength={64}
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all pr-12"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
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
                <div className="mt-2 flex flex-col gap-1.5">
                  {[
                    { check: password.length >= 8, label: 'Al menos 8 caracteres' },
                    { check: /[A-Z]/.test(password), label: 'Una mayúscula' },
                    { check: /[0-9]/.test(password), label: 'Un número' },
                  ].map((req) => (
                    <div key={req.label} className={`flex items-center gap-2 text-xs transition-colors ${req.check ? 'text-green-600' : password ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}>
                      <span className={`material-symbols-outlined text-sm ${req.check ? 'text-green-500' : 'text-on-surface-variant/30'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {req.check ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      {req.label}
                    </div>
                  ))}
                  {password && (
                    <div className="mt-1">
                      <PasswordStrengthBar password={password} />
                    </div>
                  )}
                </div>
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
                    <a href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Términos y Condiciones</a>
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
                    <a href="/politica-de-privacidad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Política de Privacidad</a>
                    {' '}y el tratamiento de mis datos personales según la Ley 1581 de 2012.
                  </span>
                </label>
              </div>

              <Button variant="primary" fullWidth loading={loading} type="submit" disabled={!isFormValid}>
                {loading ? 'Creando cuenta...' : 'Empezar gratis'}
              </Button>
              {!isFormValid && !loading && (
                <p className="text-xs text-center text-on-surface-variant mt-3">
                  Completa todos los campos y acepta los términos para continuar. Si el botón sigue deshabilitado, espera un momento mientras verificamos que no eres un robot.
                </p>
              )}
            </form>

            {rateLimited && (
              <div role="alert" className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">hourglass_top</span>
                <p>Has alcanzado el límite de intentos. Espera 15 minutos y vuelve a intentarlo.</p>
              </div>
            )}

            <div ref={containerRef} className="absolute" />
          </div>
        </div>
      </main>
      <AuthBottomNav />
    </>
  );
}

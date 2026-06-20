import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { useTurnstile } from '../hooks/useTurnstile';
import LoadingSpinner from '../components/LoadingSpinner';
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

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { containerRef, token: turnstileToken } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  if (!resetToken) {
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

    let token = turnstileToken;
    if (!token) {
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (turnstileTokenRef.current) { token = turnstileTokenRef.current; break; }
      }
    }

    setLoading(true);
    try {
      await apiClient.post('/api/auth/reset-password', { token: resetToken, password, turnstileToken: token ?? undefined });
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
      <>
        <div className="min-h-screen flex items-center justify-center bg-surface px-4 pb-24 sm:pb-0">
          <div className="w-full max-w-md text-center">
            <span className="material-symbols-outlined text-5xl mb-4 block text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <h1 className="text-2xl font-bold text-on-surface mb-2">Contraseña actualizada</h1>
            <p className="text-on-surface-variant mb-6">Tu contraseña se ha restablecido correctamente.</p>
            <Link
              to="/login"
              className="inline-flex px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold hover:shadow-lg transition-all min-h-[44px]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
        <AuthBottomNav />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Nueva Contraseña - Fiesta y Lista</title>
        <meta name="description" content="Establece una nueva contraseña para tu cuenta de Fiesta y Lista. Ingresa y confirma tu nueva contraseña." />
        <meta property="og:title" content="Nueva Contraseña - Fiesta y Lista" />
        <meta property="og:description" content="Establece una nueva contraseña para tu cuenta de Fiesta y Lista." />
        <meta name="twitter:title" content="Nueva Contraseña - Fiesta y Lista" />
        <meta name="twitter:description" content="Establece una nueva contraseña para tu cuenta de Fiesta y Lista." />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-surface px-4 pb-24 sm:pb-0">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6" aria-label="Ir al inicio">
              <img src="/logo.png" alt="Fiesta y Lista" className="w-9 h-9 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
                Fiesta y Lista
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-on-surface">Nueva Contraseña</h1>
            <p className="text-on-surface-variant mt-1">Ingresa tu nueva contraseña</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all pr-12"
                  placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {password && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {[
                    { check: password.length >= 8, label: 'Al menos 8 caracteres' },
                    { check: /[A-Z]/.test(password), label: 'Una mayúscula' },
                    { check: /[0-9]/.test(password), label: 'Un número' },
                  ].map((req) => (
                    <div key={req.label} className={`flex items-center gap-2 text-xs transition-colors ${req.check ? 'text-green-600' : 'text-on-surface-variant/50'}`}>
                      <span className={`material-symbols-outlined text-sm ${req.check ? 'text-green-500' : 'text-on-surface-variant/30'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {req.check ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      {req.label}
                    </div>
                  ))}
                  <div className="mt-1">
                    <div className="flex items-center gap-3" aria-label={`Fortaleza de contraseña: ${getPasswordStrength(password).label}`}>
                      <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength(password).color}`} style={{ width: `${(getPasswordStrength(password).score / 5) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-medium whitespace-nowrap ${getPasswordStrength(password).color.replace('bg-', 'text-')}`}>{getPasswordStrength(password).label}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-on-surface-variant mb-1.5">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all pr-12"
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                  enterKeyHint="go"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                  aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[44px]"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Restablecer contraseña'}
            </button>
            <p className="text-center text-sm text-on-surface-variant">
              <Link to="/login" className="text-primary hover:text-primary-fixed-dim font-medium">
                Volver a iniciar sesión
              </Link>
            </p>
          </form>

          <div ref={containerRef} className="absolute -z-10 opacity-0 pointer-events-none" />
        </div>
      </div>
      <AuthBottomNav />
    </>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import { Button } from '../components/ui/Button';
import Logo from '../components/Logo';
import AuthBottomNav from '../components/AuthBottomNav';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { containerRef, token: turnstileToken } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Ingresa tu correo electrónico', 'error');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      showToast('Ingresa un correo electrónico válido', 'error');
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
    try {
      let token = turnstileToken;
      if (!token) {
        token = await waitForTurnstile(() => turnstileTokenRef.current);
      }
      if (!token) {
        showToast('Verificación de seguridad no disponible. Desactiva tu bloqueador de anuncios o intenta con otro navegador.', 'error');
        return;
      }

      await apiClient.post('/api/auth/forgot-password', { email: email.trim(), turnstileToken: token ?? undefined });
      setSent(true);
    } catch (err) {
      reportError(err, { source: 'ForgotPassword' });
      showToast(err instanceof Error ? err.message : 'Error al enviar correo', 'error');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Recuperar Contraseña - Fiesta y Lista</title>
        <meta name="description" content="Recupera tu contraseña de Fiesta y Lista. Recibirás un enlace para restablecer tu contraseña por correo electrónico." />
        <meta property="og:title" content="Recuperar Contraseña - Fiesta y Lista" />
        <meta property="og:description" content="Recupera tu contraseña de Fiesta y Lista." />
        <meta name="twitter:title" content="Recuperar Contraseña - Fiesta y Lista" />
        <meta name="twitter:description" content="Recupera tu contraseña de Fiesta y Lista." />
      </Helmet>
      <main className="min-h-screen bg-surface pb-24 sm:pb-0">
        <div className="flex items-center justify-center px-4 min-h-[calc(100dvh-6rem)] sm:min-h-screen">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" aria-label="Ir al inicio" className="inline-flex items-center gap-2 mb-6 group">
              <Logo className="w-9 h-9 transition-transform group-hover:scale-105" />
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
                Fiesta y Lista
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-on-surface">Recuperar Contraseña</h1>
            <p className="text-on-surface-variant mt-1">
              Te enviaremos un enlace para restablecer tu contraseña
            </p>
          </div>

          {sent ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-5xl mb-4 block text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
              <h2 className="text-lg font-bold text-on-surface mb-2">Revisa tu bandeja de entrada</h2>
              <p className="text-on-surface-variant mb-2">
                Si existe una cuenta con <strong className="text-on-surface-variant">{email}</strong>,
                recibirás un enlace para restablecer tu contraseña en unos minutos.
              </p>
              <p className="text-xs text-on-surface-variant/80 mb-6">
                ¿No lo encuentras? Revisa tu carpeta de spam o correo no deseado.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  to="/login"
                  className="inline-flex px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-semibold hover:shadow-lg transition-all min-h-[44px]"
                >
                  Volver a iniciar sesión
                </Link>
                <button
                  onClick={() => setSent(false)}
                  className="text-sm text-primary hover:text-primary-fixed-dim font-medium"
                >
                  Reenviar correo
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="glass-card rounded-2xl p-8 space-y-5">
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
                  enterKeyHint="go"
                  autoFocus
                />
              </div>

              <Button variant="primary" fullWidth loading={loading} type="submit">
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </Button>

              <p className="text-center text-sm text-on-surface-variant">
                <Link to="/login" className="text-primary hover:text-primary-fixed-dim font-medium">
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}

          <div ref={containerRef} className="absolute -z-10 opacity-0" />
        </div>
      </div>
      </main>
      <AuthBottomNav />
    </>
  );
}

import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { reportError } from '../lib/reportError';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../hooks/useToast';
import AuthBottomNav from '../components/AuthBottomNav';

const ERROR_MESSAGES: Record<string, string> = {
  'Token has expired': 'El enlace de verificación ya expiró. Solicita uno nuevo.',
  'Token already used': 'Este correo ya fue verificado. Puedes iniciar sesión.',
  'Invalid token': 'El enlace de verificación no es válido. Solicita uno nuevo.',
};

function mapErrorMessage(raw: string): string {
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return raw;
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Estamos verificando tu correo electrónico, esto toma solo unos segundos...');
  const [resending, setResending] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const { refreshUser, resendVerification } = useAuth();
  const navigate = useNavigate();

  const hasVerified = useRef(false);
  const wasApiError = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const statusParam = searchParams.get('status');
    const token = searchParams.get('token');

    if (statusParam === 'success') {
      setStatus('success');
      setMessage('¡Correo verificado exitosamente!');
      return;
    }

    if (statusParam === 'error') {
      const raw = searchParams.get('message') || 'Error al verificar correo';
      setStatus('error');
      setMessage(mapErrorMessage(raw));
      return;
    }

    if (!token) {
      setStatus('error');
      setMessage('El enlace de verificación no es válido. Solicita uno nuevo.');
      return;
    }

    wasApiError.current = true;
    apiClient.post('/api/auth/verify-email', { token })
      .then(async () => {
        wasApiError.current = false;
        await refreshUser();
        setStatus('success');
        setMessage('¡Correo verificado exitosamente!');
      })
      .catch((err) => {
        reportError(err, { source: 'VerifyEmail' });
        const raw = err instanceof Error ? err.message : 'Error al verificar correo';
        setStatus('error');
        setMessage(mapErrorMessage(raw));
      });
  }, [searchParams, refreshUser]);

  useEffect(() => {
    if (status !== 'success') {
      setRedirectCountdown(3);
      return;
    }
    const timer = setTimeout(() => navigate('/dashboard'), 3000);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [status, navigate]);

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification();
      showToast('Correo de verificación reenviado. Revisa tu bandeja de entrada.', 'success');
    } catch (err) {
      reportError(err, { source: 'VerifyEmail' });
      showToast('Error al reenviar verificación. Intenta de nuevo.', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleRetry = () => {
    hasVerified.current = false;
    wasApiError.current = false;
    setStatus('verifying');
    setMessage('Estamos verificando tu correo electrónico, esto toma solo unos segundos...');
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('El enlace de verificación no es válido. Solicita uno nuevo.');
      return;
    }
    wasApiError.current = true;
    apiClient.post('/api/auth/verify-email', { token })
      .then(async () => {
        wasApiError.current = false;
        await refreshUser();
        setStatus('success');
        setMessage('¡Correo verificado exitosamente!');
      })
      .catch((err) => {
        reportError(err, { source: 'VerifyEmail' });
        const raw = err instanceof Error ? err.message : 'Error al verificar correo';
        setStatus('error');
        setMessage(mapErrorMessage(raw));
      });
  };

  return (
    <>
      <main className="min-h-screen flex items-center justify-center bg-surface px-4 pb-24 sm:pb-0">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-fixed to-primary-fixed/50 flex items-center justify-center text-4xl">
          {status === 'verifying' ? (
            <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
          ) : status === 'success' ? (
            <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
          ) : (
            <span className="material-symbols-outlined text-error">error</span>
          )}
        </div>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">
          {status === 'verifying' ? 'Verificando correo...' : status === 'success' ? '¡Correo Verificado!' : 'Error de Verificación'}
        </h1>
        <p className="text-body-md text-on-surface-variant mb-6">{message}</p>
        {status === 'success' && (
          <>
            <p className="text-sm text-on-surface-variant mb-6">
              Ahora puedes crear eventos, compartir listas de regalos y recibir aportes de tus invitados.
            </p>
            <p className="text-xs text-on-surface-variant/60 mb-4">
              Serás redirigido al Dashboard en {redirectCountdown} segundos...
            </p>
            <button
              onClick={goToDashboard}
              className="inline-flex px-8 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Ir al Dashboard
            </button>
          </>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {resending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Reenviando...
                </span>
              ) : 'Reenviar verificación'}
            </button>
            {wasApiError.current && (
              <button
                onClick={handleRetry}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-3 bg-surface-container-high text-on-surface rounded-xl font-semibold hover:bg-surface-container-highest transition-all"
              >
                Reintentar
              </button>
            )}
            <Link
              to="/"
              className="inline-flex px-8 py-3 border border-outline text-on-surface-variant rounded-xl font-semibold hover:bg-surface-variant transition-all"
            >
              Volver al inicio
            </Link>
          </div>
        )}
      </div>
    </main>
    <AuthBottomNav />
  </>);
}

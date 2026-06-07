import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AuthBottomNav from '../components/AuthBottomNav';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verificando...');
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no encontrado');
      return;
    }

    apiClient.post('/api/auth/verify-email', { token })
      .then(async () => {
        await refreshUser();
        setStatus('success');
        setMessage('¡Correo verificado exitosamente!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Error al verificar correo');
      });
  }, []); // Intencionalmente vacío: solo se ejecuta al montar

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <>
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-fixed/10 via-surface to-surface px-4 pb-24 sm:pb-0">
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
          {status === 'verifying' ? 'Verificando...' : status === 'success' ? '¡Correo Verificado!' : 'Error de Verificación'}
        </h1>
        <p className="text-body-md text-on-surface-variant mb-8">{message}</p>
        {status === 'success' && (
          <button
            onClick={goToDashboard}
            className="inline-flex px-8 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Ir al Dashboard
          </button>
        )}
        {status === 'error' && (
          <Link
            to="/"
            className="inline-flex px-8 py-3 border border-outline text-on-surface-variant rounded-xl font-semibold hover:bg-surface-variant transition-all"
          >
            Volver al inicio
          </Link>
        )}
      </div>
    </div>
    <AuthBottomNav />
  </>);
}

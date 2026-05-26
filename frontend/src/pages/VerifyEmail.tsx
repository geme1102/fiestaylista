import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verificando...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no encontrado');
      return;
    }

    apiClient.post('/api/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        setMessage('¡Correo verificado exitosamente!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Error al verificar correo');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-900 px-4">
      <div className="text-center max-w-md">
        <span className="text-6xl block mb-6">
          {status === 'verifying' ? '⏳' : status === 'success' ? '✅' : '❌'}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {status === 'verifying' ? 'Verificando...' : status === 'success' ? '¡Correo Verificado!' : 'Error de Verificación'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{message}</p>
        {status === 'success' && (
          <Link
            to="/dashboard"
            className="inline-flex px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Ir al Dashboard
          </Link>
        )}
        {status === 'error' && (
          <Link
            to="/"
            className="inline-flex px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Volver al inicio
          </Link>
        )}
      </div>
    </div>
  );
}

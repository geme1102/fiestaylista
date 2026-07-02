import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Si no hay token almacenado, evitar flash de loading — redirigir inmediatamente
  if (isLoading) {
    const hasToken = (() => { try { return !!sessionStorage.getItem('fy_rt'); } catch { return false; } })();
    if (!hasToken) {
      const params = new URLSearchParams({ redirect: location.pathname + location.search });
      return <Navigate to={`/login?${params}`} replace />;
    }
    return <LoadingSpinner fullScreen text="Cargando..." />;
  }

  if (!isAuthenticated) {
    const params = new URLSearchParams({ redirect: location.pathname + location.search });
    return <Navigate to={`/login?${params}`} replace />;
  }

  return <Outlet />;
}

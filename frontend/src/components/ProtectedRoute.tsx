import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando..." />;
  }

  if (!isAuthenticated) {
    const params = new URLSearchParams({ redirect: location.pathname + location.search });
    return <Navigate to={`/login?${params}`} replace />;
  }

  return <Outlet />;
}

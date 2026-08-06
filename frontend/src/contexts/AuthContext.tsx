import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User, AuthResponse } from '../types';
import { login as loginApi, register as registerApi, getMe, logout as logoutApi } from '../services/auth';
import { setTokens, clearTokens, getAccessToken, tryRefreshToken, apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  login: (email: string, password: string, turnstileToken?: string) => Promise<AuthResponse>;
  register: (email: string, password: string, name: string, turnstileToken?: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fetchedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      if (!getAccessToken()) {
        const refreshed = await tryRefreshToken();
        if (!refreshed) {
          if (mountedRef.current) setIsLoading(false);
          return;
        }
      }

      try {
        const res = await getMe();
        if (!mountedRef.current) return;
        if (!res.user || res.isGuest) {
          clearTokens();
          setUser(null);
        } else {
          setUser(res.user);
        }
      } catch (err) {
        reportError(err, { source: 'AuthContext' });
        if (err instanceof Error && !err.message.includes('Sesión expirada') && !err.message.includes('No autorizado')) {
          if (err.message.includes('Error de conexión')) {
            if (import.meta.env.DEV) console.warn('[Auth] Error de conexión restaurando sesión:', err.message);
            showToast('Error de conexión. Reintentando...', 'info');
          } else if (import.meta.env.DEV) {
            console.warn('[Auth] No se pudo restaurar la sesión:', err);
          }
        }
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    })();

    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const handler = () => {
      clearTokens();
      setUser(null);
      showToast('Sesión expirada. Serás redirigido al inicio de sesión.', 'error');
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [navigate]);

  const login = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    const res = await loginApi(email, password, turnstileToken);
    if (!res.accessToken || !res.user) {
      throw new Error('Respuesta inválida del servidor. Intenta de nuevo más tarde.');
    }
    setTokens(res.accessToken);
    setUser(res.user);
    return res;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, turnstileToken?: string) => {
    const res = await registerApi(email, password, name, turnstileToken);
    if (!res.accessToken || !res.user) {
      throw new Error('Respuesta inválida del servidor al registrarse. Intenta de nuevo.');
    }
    setTokens(res.accessToken);
    setUser(res.user);
    return res;
  }, []);

  const logout = useCallback(() => {
    setIsLoggingOut(true);
    logoutApi().catch((err) => {
      reportError(err, { source: 'AuthContext' });
      if (import.meta.env.DEV) console.error('[Auth] Error en logout:', err);
    });
    navigate('/', { replace: true });
    clearTokens();
    try { document.cookie = 'hasRefresh=; max-age=0; path=/'; } catch {}
    // A3: limpiar la caché de API del SW — aunque el regex de runtimeCaching ya
    // solo cachea endpoints públicos, esto garantiza que nada del usuario
    // anterior sobreviva al logout en un dispositivo compartido.
    try {
      if ('caches' in window) {
        caches.delete('api-cache').catch(() => {});
      }
    } catch {}
    setUser(null);
  }, [navigate]);

  useEffect(() => {
    if (isLoggingOut && location.pathname === '/') {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, location.pathname]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      if (!res.user) {
        clearTokens();
        setUser(null);
        return;
      }
      setUser(res.user);
    } catch (err) {
      reportError(err, { source: 'AuthContext' });
      if (err instanceof Error && !err.message.includes('Sesión expirada') && !err.message.includes('No autorizado')) {
        if (err.message.includes('Error de conexión')) {
          if (import.meta.env.DEV) console.warn('[Auth] Error de conexión refrescando usuario:', err.message);
          showToast('Error de conexión. Manteniendo la sesión actual.', 'info');
        } else if (import.meta.env.DEV) {
          console.error('[Auth] Error transitorio refrescando usuario:', err);
        }
        return;
      }
      clearTokens();
      setUser(null);
    }
  }, []);

  const resendVerification = useCallback(async () => {
    try {
      await apiClient.post('/api/auth/resend-verification');
    } catch (err) {
      reportError(err, { source: 'AuthContext' });
      if (import.meta.env.DEV) console.error('[Auth] Error reenviando verificación:', err);
      throw err;
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    isLoggingOut,
    login,
    register,
    logout,
    refreshUser,
    resendVerification,
  }), [user, isLoading, isLoggingOut, login, register, logout, refreshUser, resendVerification]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

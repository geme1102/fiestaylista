import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import type { User, AuthResponse } from '../types';
import { login as loginApi, register as registerApi, getMe } from '../services/auth';
import { setTokens, clearTokens, getAccessToken, tryRefreshToken, apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, turnstileToken?: string) => Promise<AuthResponse>;
  register: (email: string, password: string, name: string, turnstileToken?: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      if (!getAccessToken()) {
        const refreshed = await tryRefreshToken();
        if (!refreshed) {
          setIsLoading(false);
          return;
        }
      }

      try {
        const res = await getMe();
        if (res.isGuest) {
          clearTokens();
          setUser(null);
        } else {
          setUser(res.user);
        }
      } catch (err) {
        reportError(err, { source: 'AuthContext' });
        if (import.meta.env.DEV) console.warn('[Auth] No se pudo restaurar la sesión:', err);
        showToast('Error al restaurar tu sesión. Intenta iniciar sesión de nuevo.', 'error');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    const res = await loginApi(email, password, turnstileToken);
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, turnstileToken?: string) => {
    const res = await registerApi(email, password, name, turnstileToken);
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res;
  }, []);

  const logout = useCallback(() => {
    apiClient.post('/api/auth/logout').catch((err) => {
      reportError(err, { source: 'AuthContext' });
      if (import.meta.env.DEV) console.error('[Auth] Error en logout:', err);
    });
    clearTokens();
    setUser(null);
    window.location.href = '/';
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.user);
    } catch (err) {
      reportError(err, { source: 'AuthContext' });
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
    login,
    register,
    logout,
    refreshUser,
    resendVerification,
  }), [user, isLoading, login, register, logout, refreshUser, resendVerification]);

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

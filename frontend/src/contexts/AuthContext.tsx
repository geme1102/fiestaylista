import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import * as auth from '../services/auth';
import { setTokens, clearTokens, apiClient } from '../services/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    auth.getMe()
      .then((res) => {
        if (res.isGuest) {
          clearTokens();
          setUser(null);
        } else {
          setUser(res.user);
        }
      })
      .catch((err) => {
        console.warn('[Auth] No se pudo restaurar la sesión:', err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password);
    setTokens(res.accessToken);
    setUser(res.user);
    const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      const target = redirect && redirect.startsWith('/') ? redirect : '/dashboard';
      navigate(target);
  }, [navigate]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await auth.register(email, password, name);
    setTokens(res.accessToken);
    setUser(res.user);
    navigate('/onboarding');
  }, [navigate]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    navigate('/');
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await auth.getMe();
      setUser(res.user);
    } catch {
      clearTokens();
      setUser(null);
    }
  }, []);

  const resendVerification = useCallback(async () => {
    await apiClient.post('/api/auth/resend-verification');
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

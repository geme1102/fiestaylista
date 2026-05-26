import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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

  useEffect(() => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      setIsLoading(false);
      return;
    }
    auth.getMe()
      .then((res) => setUser(res.user))
      .catch(() => clearTokens())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password);
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    navigate('/dashboard');
  }, [navigate]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await auth.register(email, password, name);
    setTokens(res.accessToken, res.refreshToken);
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
      // Silently fail
    }
  }, []);

  const resendVerification = useCallback(async () => {
    await apiClient.post('/api/auth/resend-verification');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

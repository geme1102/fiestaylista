import { apiClient } from './api';
import type { AuthResponse, User } from '../types';

export function register(email: string, password: string, name: string, turnstileToken?: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/register', { email, password, name, turnstileToken });
}

export function login(email: string, password: string, turnstileToken?: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/login', { email, password, turnstileToken }, { skipAuthRedirect: true, skipRefresh: true });
}

export function logout(): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>('/api/auth/logout', undefined, { skipAuthRedirect: true, headers: { 'X-Logout-Request': 'true' } });
}

export function getMe(): Promise<{ user: User | null; isGuest?: boolean }> {
  return apiClient.get<{ user: User | null; isGuest?: boolean }>('/api/auth/me', { skipAuthRedirect: true, skipRefresh: true });
}

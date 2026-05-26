import { apiClient } from './api';
import type { AuthResponse, User } from '../types';

export function register(email: string, password: string, name: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/register', { email, password, name });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/login', { email, password });
}

export function refresh(refreshToken: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/refresh', { refreshToken });
}

export function getMe(): Promise<{ user: User }> {
  return apiClient.get<{ user: User }>('/api/auth/me');
}

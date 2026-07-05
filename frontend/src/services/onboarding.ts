import { apiClient } from './api';

export async function completeOnboarding(): Promise<void> {
  await apiClient.patch('/api/auth/onboarding');
}

export async function completeWelcome(): Promise<void> {
  await apiClient.patch('/api/auth/welcome');
}

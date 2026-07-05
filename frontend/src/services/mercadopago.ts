import { apiClient } from './api';
import type { Subscription, Tier, ProPayment } from '../types';

export function createCheckoutSession(tier: Tier, successUrl?: string, cancelUrl?: string, interval?: 'month' | 'year', turnstileToken?: string): Promise<{ url: string }> {
  return apiClient.post<{ url: string }>('/api/subscriptions/create-checkout', {
    tier,
    interval: interval ?? 'month',
    successUrl: successUrl ?? `${window.location.origin}/dashboard`,
    cancelUrl: cancelUrl ?? `${window.location.origin}/pricing`,
    turnstileToken,
  });
}

export function getCurrentSubscription(signal?: AbortSignal): Promise<{ subscription: Subscription | null }> {
  return apiClient.get<{ subscription: Subscription | null }>('/api/subscriptions/current', { signal });
}

export function getPaymentHistory(signal?: AbortSignal): Promise<{ payments: ProPayment[] }> {
  return apiClient.get<{ payments: ProPayment[] }>('/api/subscriptions/payments', { signal });
}

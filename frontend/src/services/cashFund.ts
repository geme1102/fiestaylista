import { apiClient } from './api';
import type { CashFund, CashContribution } from '../types';
import type { RequestOptions } from './api';

export function getCashFund(eventId: string, options?: RequestOptions): Promise<{ cashFund: CashFund | null; promisedTotal?: number }> {
  return options ? apiClient.get<{ cashFund: CashFund | null; promisedTotal?: number }>(`/api/events/${eventId}/cash-fund`, options) : apiClient.get<{ cashFund: CashFund | null; promisedTotal?: number }>(`/api/events/${eventId}/cash-fund`);
}

export function getContributions(cashFundId: string, options?: RequestOptions): Promise<{ contributions: CashContribution[]; nextCursor: string | null }> {
  const merged = { skipAuthRedirect: true, ...options };
  return apiClient.get<{ contributions: CashContribution[]; nextCursor: string | null }>(`/api/cash-fund/${cashFundId}/contributions`, merged);
}

export function activateCashFund(eventId: string, options?: RequestOptions): Promise<{ cashFund: CashFund }> {
  return options ? apiClient.put<{ cashFund: CashFund }>(`/api/events/${eventId}/cash-fund`, {}, options) : apiClient.put<{ cashFund: CashFund }>(`/api/events/${eventId}/cash-fund`, {});
}

export function createPromise(data: { cashFundId: string; contributorName: string; amount: number; message?: string; turnstileToken?: string }, options?: RequestOptions): Promise<{ contribution: CashContribution; cashFund: CashFund }> {
  return options ? apiClient.post<{ contribution: CashContribution; cashFund: CashFund }>('/api/cash-fund/promise', data, options) : apiClient.post<{ contribution: CashContribution; cashFund: CashFund }>('/api/cash-fund/promise', data);
}

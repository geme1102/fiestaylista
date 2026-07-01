import { apiClient } from './api';
import type { CashFund, CashContribution } from '../types';

export function getCashFund(eventId: string): Promise<{ cashFund: CashFund | null; promisedTotal?: number }> {
  return apiClient.get<{ cashFund: CashFund | null; promisedTotal?: number }>(`/api/events/${eventId}/cash-fund`);
}

export function getContributions(cashFundId: string): Promise<{ contributions: CashContribution[]; nextCursor: string | null }> {
  return apiClient.get<{ contributions: CashContribution[]; nextCursor: string | null }>(`/api/cash-fund/${cashFundId}/contributions`, { skipAuthRedirect: true });
}

export function boostEvent(eventId: string): Promise<{ url?: string; message?: string; boostedUntil?: string }> {
  return apiClient.post<{ url?: string; message?: string; boostedUntil?: string }>(`/api/events/${eventId}/boost`);
}

export function createPromise(data: { cashFundId: string; contributorName: string; amount: number; message?: string; turnstileToken?: string }): Promise<{ contribution: CashContribution; cashFund: CashFund }> {
  return apiClient.post<{ contribution: CashContribution; cashFund: CashFund }>('/api/cash-fund/promise', data);
}

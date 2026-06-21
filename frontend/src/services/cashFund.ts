import { apiClient } from './api';
import type { CashFund, CashContribution } from '../types';

interface ContributeData {
  cashFundId: string;
  contributorName: string;
  amount: number;
  message?: string;
  turnstileToken?: string;
}

interface ContributeResult {
  redirectUrl: string;
  contributionId: string;
}

export function getCashFund(eventId: string): Promise<{ cashFund: CashFund | null }> {
  return apiClient.get<{ cashFund: CashFund | null }>(`/api/events/${eventId}/cash-fund`);
}

export function createContribution(data: ContributeData): Promise<ContributeResult> {
  const { amount, cashFundId, contributorName, message, turnstileToken } = data;
  return apiClient.post<ContributeResult>('/api/cash-fund/contribute', {
    cashFundId,
    contributorName,
    amount,
    message,
    turnstileToken,
  });
}

export function getContributions(cashFundId: string): Promise<{ contributions: CashContribution[] }> {
  return apiClient.get<{ contributions: CashContribution[] }>(`/api/cash-fund/${cashFundId}/contributions`);
}

export function boostEvent(eventId: string): Promise<{ url?: string; message?: string; boostedUntil?: string }> {
  return apiClient.post<{ url?: string; message?: string; boostedUntil?: string }>(`/api/events/${eventId}/boost`);
}

export function createPromise(data: { cashFundId: string; contributorName: string; amount: number; message?: string }): Promise<{ contribution: CashContribution }> {
  return apiClient.post<{ contribution: CashContribution }>('/api/cash-fund/promise', data);
}

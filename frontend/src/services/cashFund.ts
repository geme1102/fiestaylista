import { apiClient } from './api';
import type { CashFund, CashContribution } from '../types';

interface CreateFundData {
  title?: string;
  description?: string;
  targetAmount?: number;
}

interface ContributeData {
  cashFundId: string;
  contributorName: string;
  amount: number;
  message?: string;
}

interface ContributeResult {
  redirectUrl: string;
  contributionId: string;
}

export function createOrUpdateCashFund(eventId: string, data: CreateFundData): Promise<{ cashFund: CashFund }> {
  return apiClient.put<{ cashFund: CashFund }>(`/api/events/${eventId}/cash-fund`, data);
}

export function getCashFund(eventId: string): Promise<{ cashFund: CashFund | null }> {
  return apiClient.get<{ cashFund: CashFund | null }>(`/api/events/${eventId}/cash-fund`);
}

export function createContribution(data: ContributeData): Promise<ContributeResult> {
  return apiClient.post<ContributeResult>('/api/cash-fund/contribute', data);
}

export function getContributions(cashFundId: string): Promise<{ contributions: CashContribution[] }> {
  return apiClient.get<{ contributions: CashContribution[] }>(`/api/cash-fund/${cashFundId}/contributions`);
}

export function boostEvent(eventId: string): Promise<{ url?: string; message?: string; boostedUntil?: string }> {
  return apiClient.post<{ url?: string; message?: string; boostedUntil?: string }>(`/api/events/${eventId}/boost`);
}

export function getBoostStatus(eventId: string): Promise<{ isBoosted: boolean; boostedUntil: string | null }> {
  return apiClient.get<{ isBoosted: boolean; boostedUntil: string | null }>(`/api/events/${eventId}/boost-status`);
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/api', () => ({ apiClient: mockApiClient }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual };
});

import Statistics from '../pages/Statistics';

function renderStatistics() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/statistics']}>
        <Routes>
          <Route path="/statistics" element={<Statistics />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Statistics', () => {
  it('shows upgrade prompt for non-pro users', () => {
    mockUseAuth.mockReturnValue({ user: { tier: 'free' } });
    renderStatistics();
    expect(screen.getByText('Estadísticas exclusivas para Plan Pro')).toBeTruthy();
    expect(screen.getByText('Ver Planes')).toBeTruthy();
  });

  it('shows loading spinner for pro users', () => {
    mockUseAuth.mockReturnValue({ user: { tier: 'pro' } });
    mockApiClient.get.mockReturnValue(new Promise(() => {}));
    renderStatistics();
    expect(screen.getByText('card_giftcard')).toBeTruthy();
  });

  it('shows stats dashboard for pro users with events', async () => {
    mockUseAuth.mockReturnValue({ user: { tier: 'pro', name: 'Ana' } });
    mockApiClient.get.mockResolvedValue({ events: [{ id: 'e1', name: 'Mi Boda', cashFund: { collectedAmount: 50000 } }] });
    mockApiClient.post.mockResolvedValue({ views: {} });
    renderStatistics();
    await waitFor(() => {
      expect(screen.getByText('Estadísticas')).toBeTruthy();
    });
  });
});

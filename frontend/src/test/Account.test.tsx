import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockGetCurrentSubscription = vi.hoisted(() => vi.fn());
const mockGetPaymentHistory = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());
const mockFormatDate = vi.hoisted(() => vi.fn(() => '1 ene 2024'));
const mockUseAchievements = vi.hoisted(() => vi.fn(() => ({ getEarned: () => new Set(), allAchievements: [] })));
const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/mercadopago', () => ({ getCurrentSubscription: mockGetCurrentSubscription, getPaymentHistory: mockGetPaymentHistory }));
vi.mock('../hooks/useToast', () => ({ showToast: mockShowToast }));
vi.mock('../utils/format', () => ({ formatDate: mockFormatDate, validateRedirectUrl: (url: string) => url }));
vi.mock('../hooks/useAchievements', () => ({ useAchievements: () => mockUseAchievements() }));
vi.mock('../components/LoadingSpinner', () => ({ default: () => <div data-testid="loading-spinner" /> }));
vi.mock('../components/AchievementsStrip', () => ({ AchievementsStrip: () => <div data-testid="achievements-strip" /> }));
vi.mock('../services/api', () => ({ apiClient: { post: mockApiPost } }));
vi.mock('../hooks/useTurnstile', () => ({
  useTurnstile: () => ({ containerRef: { current: null }, token: 'tok-1', ready: true, error: null, reset: vi.fn() }),
  waitForTurnstile: vi.fn(() => 'tok-1'),
}));
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import Account from '../pages/Account';

const mockUser = {
  id: 'user-1',
  name: 'Ana García',
  email: 'ana@test.com',
  emailVerified: true,
  tier: 'free' as const,
  createdAt: '2024-01-01T00:00:00Z',
};

const mockProPlusUser = {
  id: 'user-2',
  name: 'Carlos López',
  email: 'carlos@test.com',
  emailVerified: true,
  tier: 'pro_plus' as const,
  createdAt: '2024-01-01T00:00:00Z',
};

const mockSubscription = {
  id: 'sub-1',
  userId: 'user-1',
  tier: 'pro' as const,
  status: 'active' as const,
  currentPeriodEnd: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: mockUser, resendVerification: vi.fn(), refreshUser: vi.fn(), logout: vi.fn() });
  mockGetCurrentSubscription.mockResolvedValue({ subscription: mockSubscription });
  mockGetPaymentHistory.mockResolvedValue({ payments: [] });
});

function renderAccount() {
  return render(
    <MemoryRouter>
      <Account />
    </MemoryRouter>
  );
}

describe('Account', () => {
  it('renders user info', async () => {
    renderAccount();
    await waitFor(() => {
      expect(screen.getByText('Mi Cuenta')).toBeTruthy();
    });
    expect(screen.getByText('Ana García')).toBeTruthy();
    expect(screen.getByText('ana@test.com')).toBeTruthy();
  });

  it('renders subscription section with plan and limits', async () => {
    renderAccount();
    await waitFor(() => {
      expect(screen.getByText('Plan Gratis')).toBeTruthy();
    });
    expect(screen.getByText('FREE')).toBeTruthy();
    expect(screen.getByText('Mejorar a Pro')).toBeTruthy();
  });

  it('renders achievements section', async () => {
    renderAccount();
    await waitFor(() => {
      expect(screen.getByText('TUS LOGROS')).toBeTruthy();
    });
  });

  it('renders data download and delete buttons', async () => {
    renderAccount();
    await waitFor(() => {
      expect(screen.getByTestId('download-data-button')).toBeTruthy();
      expect(screen.getByTestId('delete-account-button')).toBeTruthy();
    });
  });

  it('renders Pro Plus plan badge when user tier is pro_plus', async () => {
    mockUseAuth.mockReturnValue({ user: mockProPlusUser, resendVerification: vi.fn(), refreshUser: vi.fn(), logout: vi.fn() });

    renderAccount();
    await waitFor(() => {
      expect(screen.getByText('Plan Pro Plus')).toBeTruthy();
    });
    expect(screen.getByText('PRO PLUS')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows upgrade to Pro Plus button for pro users', async () => {
    mockUseAuth.mockReturnValue({ user: { ...mockUser, tier: 'pro' as const }, resendVerification: vi.fn(), refreshUser: vi.fn(), logout: vi.fn() });

    renderAccount();
    await waitFor(() => {
      expect(screen.getByText('Mejorar a Pro Plus')).toBeTruthy();
    });
  });

  it('M3: retry de past_due preserva el intervalo anual de la suscripción', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true });

    mockApiPost.mockResolvedValue({ url: 'https://mpago.test/checkout' });
    mockUseAuth.mockReturnValue({ user: { ...mockUser, tier: 'pro' as const }, resendVerification: vi.fn(), refreshUser: vi.fn(), logout: vi.fn() });
    mockGetCurrentSubscription.mockResolvedValue({
      subscription: {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'pro' as const,
        status: 'past_due' as const,
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2025-01-01T00:00:00Z',
      },
    });

    renderAccount();
    await waitFor(() => {
      expect(screen.getByText('Pago vencido')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Reintentar pago'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/subscriptions/create-checkout',
        expect.objectContaining({ tier: 'pro', interval: 'year' }),
      );
    });

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });
});

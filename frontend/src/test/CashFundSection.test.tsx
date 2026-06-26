import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CashFundSection from '../components/CashFundSection';

const mockGetCashFund = vi.hoisted(() => vi.fn());
const mockCreateContribution = vi.hoisted(() => vi.fn());
const mockGetContributions = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());
const mockTurnstile = vi.hoisted(() => vi.fn(() => ({ containerRef: { current: null }, token: 'mock-token' })));

vi.mock('../services/cashFund', () => ({
  getCashFund: mockGetCashFund,
  createContribution: mockCreateContribution,
  getContributions: mockGetContributions,
  boostEvent: vi.fn(),
  createPromise: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  showToast: mockShowToast,
}));

vi.mock('../hooks/useTurnstile', () => ({
  useTurnstile: mockTurnstile,
}));

const activeFund = {
  id: 'fund-1', eventId: 'event-1', isActive: true,
  collectedAmount: 0, targetAmount: 100000,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCashFund.mockResolvedValue({ cashFund: activeFund, promisedTotal: 0 });
  mockGetContributions.mockResolvedValue({ contributions: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function waitForForm(container: HTMLElement) {
  await waitFor(() => {
    const form = container.querySelector('form');
    expect(form).toBeTruthy();
  });
  return container.querySelector('form')!;
}

describe('CashFundSection', () => {
  it('shows contribution form when user is not owner', async () => {
    render(<CashFundSection eventId="event-1" isOwner={false} ownerTier="free" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Otro valor')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Ej. Familia Rodríguez')).toBeInTheDocument();
  });

  it('hides contribution form for event owner', async () => {
    render(<CashFundSection eventId="event-1" isOwner={true} ownerTier="free" />);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Otro valor')).not.toBeInTheDocument();
    });
  });

  it('validates amount below minimum', async () => {
    const { container } = render(<CashFundSection eventId="event-1" isOwner={false} ownerTier="free" />);
    const form = await waitForForm(container);

    fireEvent.change(screen.getByPlaceholderText('Otro valor'), { target: { value: '500' } });
    fireEvent.submit(form);

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('$2,000'), 'error');
  });

  it('validates amount above maximum', async () => {
    const { container } = render(<CashFundSection eventId="event-1" isOwner={false} ownerTier="free" />);
    const form = await waitForForm(container);

    fireEvent.change(screen.getByPlaceholderText('Otro valor'), { target: { value: '9999999' } });
    fireEvent.submit(form);

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('$5'), 'error');
  });

  it('validates non-integer amount', async () => {
    const { container } = render(<CashFundSection eventId="event-1" isOwner={false} ownerTier="free" />);
    const form = await waitForForm(container);

    fireEvent.change(screen.getByPlaceholderText('Otro valor'), { target: { value: '2500.50' } });
    fireEvent.submit(form);

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('$2,000'), 'error');
  });

  it('calls createContribution with valid data', async () => {
    mockCreateContribution.mockResolvedValue({ redirect: 'https://mpago.la/test' });
    delete (window as any).location;
    (window as any).location = { href: '' };

    const { container } = render(<CashFundSection eventId="event-1" isOwner={false} ownerTier="free" />);
    const form = await waitForForm(container);

    fireEvent.change(screen.getByPlaceholderText('Ej. Familia Rodríguez'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByPlaceholderText('Otro valor'), { target: { value: '50000' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockCreateContribution).toHaveBeenCalledWith(
        expect.objectContaining({ contributorName: 'Maria', amount: 50000 })
      );
    });
  });
});

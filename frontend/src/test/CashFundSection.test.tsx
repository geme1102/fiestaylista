import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CashFundSection from '../components/CashFundSection';

const mockGetCashFund = vi.hoisted(() => vi.fn());
const mockGetContributions = vi.hoisted(() => vi.fn());
const mockCreatePromise = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());

vi.mock('../services/cashFund', () => ({
  getCashFund: mockGetCashFund,
  getContributions: mockGetContributions,
  activateCashFund: vi.fn(),
  createPromise: mockCreatePromise,
}));

vi.mock('../hooks/useToast', () => ({
  showToast: mockShowToast,
}));

vi.mock('../utils/format', () => ({
  formatCOP: (v: number) => `$${v.toLocaleString('es-CO')} COP`,
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

describe('CashFundSection', () => {
  it('shows promise form register for guests', async () => {
    render(<CashFundSection eventId="event-1" isOwner={false} guestName="Maria" />);

    await waitFor(() => {
      expect(screen.getByText('Ya transferiste? Regístralo aquí')).toBeInTheDocument();
    });
  });

  it('hides promise form for event owner', async () => {
    render(<CashFundSection eventId="event-1" isOwner={true} guestName="Maria" />);

    await waitFor(() => {
      expect(screen.queryByText('Ya transferiste? Regístralo aquí')).not.toBeInTheDocument();
    });
  });

  it('shows progress bar with collected amount', async () => {
    mockGetCashFund.mockResolvedValue({ cashFund: { ...activeFund, collectedAmount: 50000 }, promisedTotal: 0 });

    const { container } = render(<CashFundSection eventId="event-1" isOwner={false} />);

    await waitFor(() => {
      expect(container.textContent).toContain('$50.000');
    });
  });

  it('shows activation button for owner when no fund exists', async () => {
    mockGetCashFund.mockResolvedValue({ cashFund: null, promisedTotal: 0 });

    render(<CashFundSection eventId="event-1" isOwner={true} />);

    await waitFor(() => {
      expect(screen.getByText('Activar gratis')).toBeInTheDocument();
    });
  });

  it('activates the cash fund via activateCashFund when owner clicks Activar gratis', async () => {
    mockGetCashFund.mockResolvedValue({ cashFund: null, promisedTotal: 0 });
    const { activateCashFund } = await import('../services/cashFund');
    const mockActivate = vi.mocked(activateCashFund).mockResolvedValue({ cashFund: { ...activeFund, id: 'fund-new', title: 'Lluvia de sobres' } });

    render(<CashFundSection eventId="event-1" isOwner={true} />);

    await waitFor(() => {
      expect(screen.getByText('Activar gratis')).toBeInTheDocument();
    });
    screen.getByText('Activar gratis').click();

    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith('event-1');
    });
  });

  it('shows activation button for owner when fund exists but inactive', async () => {
    mockGetCashFund.mockResolvedValue({ cashFund: { ...activeFund, isActive: false }, promisedTotal: 0 });

    render(<CashFundSection eventId="event-1" isOwner={true} />);

    await waitFor(() => {
      expect(screen.getByText('Activar')).toBeInTheDocument();
    });
  });

  it('shows bank account info when configured', async () => {
    mockGetCashFund.mockResolvedValue({ cashFund: { ...activeFund, bankPhone: '3001234567', bankType: 'nequi' }, promisedTotal: 0 });

    render(<CashFundSection eventId="event-1" isOwner={false} />);

    await waitFor(() => {
      expect(screen.getByText('Nequi')).toBeInTheDocument();
      expect(screen.getByText('3001234567')).toBeInTheDocument();
    });
  });
});

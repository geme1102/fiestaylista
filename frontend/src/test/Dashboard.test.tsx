import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseAuth = vi.hoisted(() => vi.fn().mockReturnValue({ user: { tier: 'free' }, isAuthenticated: true, refreshUser: vi.fn() }));
const mockApiClientGet = vi.hoisted(() => vi.fn());
const mockApiClientPost = vi.hoisted(() => vi.fn());
const mockApiClientDel = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());
// showToast is mocked below via mockShowToast
const mockUseLocation = vi.hoisted(() => vi.fn().mockReturnValue({ search: '' }));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiClientGet(...args),
    post: (...args: unknown[]) => mockApiClientPost(...args),
    del: (...args: unknown[]) => mockApiClientDel(...args),
  },
}));
vi.mock('../hooks/useToast', () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../utils/format', () => ({ formatCOP: (v: number) => `$${v.toLocaleString('es-CO')}` }));
vi.mock('../components/LoadingSpinner', () => ({ default: ({ size }: { size?: string }) => <div data-testid="loading-spinner" className={size} /> }));
vi.mock('../components/ConfirmModal', () => ({
  ConfirmModal: ({ message, onConfirm, onClose, loading }: {
    message: string; onConfirm: () => void; onClose: () => void; loading?: boolean;
  }) => (
    <div data-testid="confirm-modal">
      <p>{message}</p>
      <button data-testid="confirm-delete" onClick={onConfirm} disabled={loading}>Confirmar</button>
      <button data-testid="cancel-delete" onClick={onClose}>Cancelar</button>
    </div>
  ),
}));
vi.mock('../components/InstallPwaBanner', () => ({ default: () => null }));
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { initial, animate, exit, transition, ...rest } = props as any;
        return <div {...rest}>{children}</div>;
      },
      button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props as any;
        return <button {...rest}>{children}</button>;
      },
    },
  };
});

const mockSingleEvent = {
  id: 'evt-1',
  title: 'Baby Shower María',
  eventType: 'BABY_SHOWER' as const,
  slug: 'baby-maria',
  giftCount: 5,
  photoCount: 2,
  cashFund: { collectedAmount: 150000 },
  isActive: true,
  frozenAt: null as string | null,
  createdAt: '2025-01-01',
  status: 'active',
};

const mockEvents = [
  mockSingleEvent,
  {
    id: 'evt-2',
    title: 'Boda Juan',
    eventType: 'WEDDING' as const,
    slug: 'boda-juan',
    giftCount: 12,
    photoCount: 0,
    cashFund: null,
    isActive: true,
    createdAt: '2025-02-01',
    status: 'active',
  },
];

function renderDashboard(events: typeof mockEvents | undefined = undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockApiClientGet.mockResolvedValue({ events: events ?? [] });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

import React from 'react';
import Dashboard from '../pages/Dashboard';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { tier: 'free' }, isAuthenticated: true, refreshUser: vi.fn() });
  mockUseLocation.mockReturnValue({ search: '' });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Dashboard', () => {
  it('shows loading skeleton while fetching events', async () => {
    mockApiClientGet.mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows onboarding when there are no events', async () => {
    renderDashboard([]);
    await waitFor(() => expect(screen.queryByText('¿Qué evento quieres crear?')).toBeTruthy());
    expect(screen.getByTestId('create-event-baby_shower')).toBeTruthy();
    expect(screen.getByTestId('create-event-wedding')).toBeTruthy();
  });

  it('shows event cards when events exist', async () => {
    renderDashboard(mockEvents);
    await waitFor(() => {
      expect(screen.getByTestId('event-card-evt-1')).toBeTruthy();
    });
    expect(screen.getByTestId('event-card-evt-2')).toBeTruthy();
  });

  it('shows stats section with event count and gift count', async () => {
    renderDashboard(mockEvents);
    await waitFor(() => {
      expect(screen.getByTestId('stat-events')).toBeTruthy();
    });
    expect(screen.getByTestId('stat-events').textContent).toContain('2');
    expect(screen.getByTestId('stat-gifts').textContent).toContain('17');
  });

  it('opens create modal from empty state onboarding', async () => {
    renderDashboard([]);
    await waitFor(() => expect(screen.getByTestId('create-event-baby_shower')).toBeTruthy());

    fireEvent.click(screen.getByTestId('create-event-baby_shower'));
    expect(screen.getByRole('dialog', { name: /Crear nuevo evento/i })).toBeTruthy();
  });

  it('shows upgrade CTA when at event limit', async () => {
    renderDashboard(mockEvents);
    await waitFor(() => {
      expect(screen.getByTestId('upgrade-cta')).toBeTruthy();
    });
  });

  it('M3: muestra badge CONGELADO en eventos con frozenAt e inactivos', async () => {
    renderDashboard([
      { ...mockSingleEvent, isActive: false, frozenAt: '2025-06-01T00:00:00Z' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('CONGELADO')).toBeTruthy();
    });
    expect(screen.queryByText('FINALIZADO')).not.toBeInTheDocument();
  });

  it('no muestra badge CONGELADO en eventos activos', async () => {
    renderDashboard(mockEvents);
    await waitFor(() => {
      expect(screen.getByTestId('event-card-evt-1')).toBeTruthy();
    });
    expect(screen.queryByText('CONGELADO')).not.toBeInTheDocument();
  });

  it('copies event link to clipboard', async () => {
    renderDashboard(mockEvents);
    await waitFor(() => {
      expect(screen.getByTestId('event-card-evt-1')).toBeTruthy();
    });

    const copyButtons = screen.getAllByLabelText(/Copiar enlace/);
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Enlace copiado ✅', 'success');
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/e/baby-maria');
  });

  it('creates event from modal and navigates', async () => {
    mockApiClientPost.mockResolvedValue({ event: { id: 'new-evt' } });
    renderDashboard([]);

    await waitFor(() => expect(screen.getByTestId('create-event-baby_shower')).toBeTruthy());
    fireEvent.click(screen.getByTestId('create-event-baby_shower'));

    const titleInput = screen.getByLabelText(/Nombre del evento/i);
    fireEvent.change(titleInput, { target: { value: 'Mi Nuevo Evento' } });

    fireEvent.click(screen.getByText('Crear Lista de Regalos'));

    await waitFor(() => {
      expect(mockApiClientPost).toHaveBeenCalledWith('/api/events', expect.objectContaining({
        title: 'Mi Nuevo Evento',
        eventType: 'BABY_SHOWER',
      }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/event/new-evt');
  });
});

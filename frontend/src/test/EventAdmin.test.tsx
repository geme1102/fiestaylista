import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 15000 });
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockApiClient = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), del: vi.fn() }));
const mockUseSSE = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/api', () => ({ apiClient: mockApiClient }));
vi.mock('../services/cashFund', () => ({ getCashFund: vi.fn().mockResolvedValue({ collectedAmount: 0, isActive: false }) }));
vi.mock('../hooks/useSSE', () => ({ useSSE: mockUseSSE }));
vi.mock('../components/ui/ProductTour', () => ({ ProductTour: () => null }));
vi.mock('../components/GiftCard', () => ({ default: () => <div /> }));
vi.mock('../components/EventReadyBar', () => ({ EventReadyBar: () => null }));
vi.mock('../components/ui/Skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
  SkeletonText: () => <div data-testid="skeleton-text" />,
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));
vi.mock('../components/admin/GiftManagement', () => ({ default: (props: any) => <div data-testid="gift-management" data-disabled={String(props.disabled)} /> }));
vi.mock('../components/admin/PhotoGallery', () => ({ PhotoGallery: (props: any) => <div data-testid="photo-gallery" data-disabled={String(props.disabled)} /> }));
vi.mock('../components/admin/GuestsPanel', () => ({ default: () => <div data-testid="guests-panel" /> }));
vi.mock('../components/admin/MessagesPanel', () => ({ default: () => <div data-testid="messages-panel" /> }));
vi.mock('../components/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('../hooks/useAchievements', () => ({ useAchievements: () => ({ evaluate: vi.fn() }) }));
vi.mock('../hooks/useToast', () => ({ showToast: vi.fn() }));
vi.mock('../services/events', () => ({ uploadPhoto: vi.fn(), addPhoto: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'evt-1' }) };
});
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import EventAdmin from '../pages/EventAdmin';

function renderAdmin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/evt-1']}>
        <Routes>
          <Route path="/event/:id" element={<EventAdmin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { name: 'Ana', tier: 'free' }, isAuthenticated: true });
  mockApiClient.get.mockResolvedValue({
    event: { id: 'evt-1', title: 'Baby Shower María', eventType: 'BABY_SHOWER', slug: 'baby-maria', isActive: true, createdAt: '2025-01-01', eventDate: '2025-06-15T15:00:00', eventLocation: 'Salón', eventNote: 'Traer pañales' },
    gifts: [{ id: 'g-1', name: 'Olla', isClaimed: false, category: 'cocina', order: 0 }],
    photos: [{ id: 'p-1', url: 'https://cdn.test/photo.jpg', caption: 'Foto', uploadedBy: 'Ana', isFeatured: false }],
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe('EventAdmin', () => {
  it('renders event title after loading', async () => {
    renderAdmin();
    const titles = await screen.findAllByText('Baby Shower María', {}, { timeout: 10000 });
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('shows event note', async () => {
    renderAdmin();
    expect(await screen.findByText('Traer pañales', {}, { timeout: 10000 })).toBeTruthy();
  });

  it('shows admin panel sections', async () => {
    renderAdmin();
    await screen.findByTestId('gift-management', {}, { timeout: 10000 });
    expect(screen.getByTestId('photo-gallery')).toBeTruthy();
    expect(screen.getByTestId('guests-panel')).toBeTruthy();
    expect(screen.getByTestId('messages-panel')).toBeTruthy();
  });

  it('navigates back on back button', async () => {
    renderAdmin();
    await screen.findAllByText('Baby Shower María', {}, { timeout: 10000 });
    fireEvent.click(screen.getByLabelText('Regresar'));
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('A1: título con solo espacios no deja el botón guardar bloqueado', async () => {
    mockApiClient.put.mockResolvedValue({
      event: { id: 'evt-1', title: 'Boda Actualizada', eventType: 'WEDDING', slug: 'boda-actualizada', isActive: true, createdAt: '2025-01-01' },
    });
    renderAdmin();
    await screen.findAllByText('Baby Shower María', {}, { timeout: 10000 });

    fireEvent.click(screen.getByTestId('edit-event-button'));
    const titleInput = document.getElementById('edit-title') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('save-event-changes'));

    expect(document.getElementById('edit-title')).toBeTruthy();
    expect(mockApiClient.put).not.toHaveBeenCalled();

    fireEvent.change(titleInput, { target: { value: 'Boda Actualizada' } });
    fireEvent.click(screen.getByTestId('save-event-changes'));

    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/api/events/evt-1',
        expect.objectContaining({ title: 'Boda Actualizada' }),
      );
    });
  });

  it('F3: evento congelado bloquea edición (pencil, toggle y paneles disabled)', async () => {
    mockApiClient.get.mockResolvedValue({
      event: { id: 'evt-1', title: 'Baby Shower María', eventType: 'BABY_SHOWER', slug: 'baby-maria', isActive: false, frozenAt: '2025-06-01T00:00:00Z', createdAt: '2025-01-01', eventDate: '2025-06-15T15:00:00', eventLocation: 'Salón', eventNote: 'Traer pañales' },
      gifts: [],
      photos: [],
    });
    renderAdmin();
    await screen.findAllByText('Baby Shower María', {}, { timeout: 10000 });

    const pencil = screen.getByTestId('edit-event-button') as HTMLButtonElement;
    expect(pencil.disabled).toBe(true);
    expect(pencil.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(pencil);
    expect(document.getElementById('edit-title')).toBeNull();

    const toggle = screen.getByTestId('toggle-event-status') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute('aria-disabled')).toBe('true');

    expect(screen.getByTestId('gift-management').getAttribute('data-disabled')).toBe('true');
    expect(screen.getByTestId('photo-gallery').getAttribute('data-disabled')).toBe('true');
  });
});

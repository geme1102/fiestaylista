import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

if (!('ResizeObserver' in globalThis)) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const mockUseEventPage = vi.fn();

vi.mock('../hooks/useEventPage', () => ({
  useEventPage: (...args: unknown[]) => mockUseEventPage(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseEventPage.mockReturnValue({
    event: { id: 'evt-1', title: 'Mi Evento', eventType: 'BABY_SHOWER', slug: 'mi-evento', isActive: true, createdAt: '2025-01-01' },
    gifts: [], photos: [], loading: false, error: null,
    claimingId: null, claimName: '', setClaimName: vi.fn(), shaking: false,
    showConfetti: false, showSuccessModal: false, setShowSuccessModal: vi.fn(),
    easyReadMode: false, setEasyReadMode: vi.fn(),
    categoryFilter: null, setCategoryFilter: vi.fn(),
    inputRef: { current: null }, filterBarRef: { current: null },
    turnstileRef: { current: null },
    availableGifts: [], claimedGifts: [], categories: [], filteredGifts: [],
    eventDateFormatted: '', eventTimeFormatted: '',
    handleClaim: vi.fn(), handleDownload: vi.fn(), reloadEvent: vi.fn(),
  });
});

afterEach(() => { vi.restoreAllMocks(); });

import EventGuestPage from '../pages/EventGuest';

describe('EventGuest page', () => {
  it('renders event title', () => {
  render(
    <MemoryRouter initialEntries={['/event/mi-evento']}>
      <EventGuestPage />
    </MemoryRouter>
  );

    expect(screen.getByText('Mi Evento')).toBeInTheDocument();
  });

  it('renders without useEventPage errors', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/event/mi-evento']}>
        <EventGuestPage />
      </MemoryRouter>
    );

    expect(container.querySelector('div')).toBeTruthy();
  });
});

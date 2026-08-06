import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetEventBySlug = vi.hoisted(() => vi.fn());
const mockApiClientPut = vi.hoisted(() => vi.fn());
const mockApiClientPost = vi.hoisted(() => vi.fn());
const mockApiClientGet = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());
const mockTurnstileToken = vi.hoisted(() => vi.fn<(...args: any[]) => string | null>(() => null));
const mockGetGiftCategory = vi.hoisted(() => vi.fn((_name: string) => ({ label: 'Regalo', color: 'bg-blue-500' })));
const mockUseSSE = vi.hoisted(() => vi.fn());

vi.mock('../services/events', () => ({ getEventBySlug: mockGetEventBySlug }));
vi.mock('../services/api', () => ({ apiClient: { put: mockApiClientPut, post: mockApiClientPost, get: mockApiClientGet } }));
vi.mock('../hooks/useToast', () => ({ showToast: mockShowToast }));
vi.mock('../hooks/useTurnstile', () => ({ useTurnstile: () => ({ containerRef: { current: null }, token: mockTurnstileToken(), reset: vi.fn() }) }));
vi.mock('../data/giftEmojis', () => ({ getGiftCategory: mockGetGiftCategory }));
vi.mock('../hooks/useSSE', () => ({ useSSE: mockUseSSE }));

let mockSlug: string | undefined = 'mi-evento';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ slug: mockSlug }),
  };
});

import { useEventPage } from '../hooks/useEventPage';

const testEvent = {
  id: 'evt-1', title: 'Mi Evento', eventType: 'BABY_SHOWER', slug: 'mi-evento',
  isActive: true, createdAt: '2025-01-01',
};

const testGifts = [
  { id: 'g-1', name: 'Olla', isClaimed: false, category: 'cocina' },
  { id: 'g-2', name: 'Cobija', isClaimed: true, claimedBy: 'Maria', category: 'bebe' },
];

const testPhotos = [{ id: 'p-1', url: 'https://cdn.test/photo.jpg', uploadedBy: 'Ana' }];

beforeEach(() => {
  vi.clearAllMocks();
  mockSlug = 'mi-evento';
  mockTurnstileToken.mockReturnValue('tok-1');
  mockGetEventBySlug.mockResolvedValue({ event: testEvent, gifts: testGifts, photos: testPhotos });
  mockGetGiftCategory.mockImplementation((name: string) => {
    const map: Record<string, { label: string; color: string }> = {
      Olla: { label: 'Cocina', color: 'bg-red-500' },
      Cobija: { label: 'Bebé', color: 'bg-blue-500' },
    };
    return map[name] ?? { label: 'Regalo', color: 'bg-gray-500' };
  });
});

afterEach(() => { vi.restoreAllMocks(); });

function renderEventPageHook() {
  return renderHook(() => useEventPage(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>,
  });
}

describe('useEventPage', () => {
  it('loads event and gifts on mount', async () => {
    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.event?.title).toBe('Mi Evento');
    });
    expect(result.current.gifts).toHaveLength(2);
    expect(result.current.photos).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error when event is inactive', async () => {
    mockGetEventBySlug.mockResolvedValue({ event: { ...testEvent, isActive: false }, gifts: [], photos: [] });

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.error).toBe('Este evento no está disponible');
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.event).toBeNull();
  });

  it('sets error when slug is invalid', async () => {
    mockGetEventBySlug.mockRejectedValue(new Error('Not found'));

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.error).toBe('Not found');
    });
    expect(result.current.loading).toBe(false);
  });

  it('remaps Sesión expirada to Evento no encontrado', async () => {
    mockGetEventBySlug.mockRejectedValue(new Error('Sesión expirada'));

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.error).toBe('Evento no encontrado');
    });
    expect(result.current.loading).toBe(false);
  });

  it('does not load when slug is undefined', async () => {
    mockSlug = undefined;

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
    expect(mockGetEventBySlug).not.toHaveBeenCalled();
  });

  it('separates available and claimed gifts', async () => {
    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.availableGifts).toHaveLength(1);
    });
    expect(result.current.availableGifts[0].id).toBe('g-1');
    expect(result.current.claimedGifts).toHaveLength(1);
    expect(result.current.claimedGifts[0].id).toBe('g-2');
  });

  it('updates gift list when SSE claims a gift', async () => {
    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.gifts).toHaveLength(2);
    });

    const sseCallbacks = mockUseSSE.mock.calls[0][0];
    act(() => {
      sseCallbacks.onGiftClaimed({ giftId: 'g-1', giftName: 'Olla', claimedBy: 'Pedro' });
    });

    expect(result.current.gifts[0].isClaimed).toBe(true);
    expect(result.current.gifts[0].claimedBy).toBe('Pedro');
  });

  it('handleClaim: shakes when no claimName', async () => {
    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.event).toBeTruthy();
    });

    act(() => { result.current.setGuestName(''); });
    await act(async () => { result.current.handleClaim('g-1', 'Olla'); });

    expect(result.current.shaking).toBe(true);
    expect(mockApiClientPut).not.toHaveBeenCalled();
  });

  it('handleClaim: claims gift successfully', async () => {
    mockApiClientPut.mockResolvedValue({ gift: { id: 'g-1', name: 'Olla', isClaimed: true, claimedBy: 'Test' } });

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.event).toBeTruthy();
    });

    act(() => { result.current.setGuestName('Test'); });
    await act(async () => { await result.current.handleClaim('g-1', 'Olla'); });

    expect(mockApiClientPut).toHaveBeenCalledWith(
      '/api/events/evt-1/gifts/g-1/claim',
      { claimedBy: 'Test', turnstileToken: 'tok-1' }
    );
    expect(mockShowToast).toHaveBeenCalledWith('¡Olla apartado! 🎉', 'success');
    expect(result.current.claimingId).toBeNull();
  });

  it('handleClaim: shows already-claimed error', async () => {
    mockApiClientPut.mockRejectedValue(new Error('El regalo ya ha sido reservado'));

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.event).toBeTruthy();
    });

    act(() => { result.current.setGuestName('Test'); });
    await act(async () => { await result.current.handleClaim('g-1', 'Olla'); });

    expect(mockShowToast).toHaveBeenCalledWith('Este regalo ya fue apartado por otra persona', 'error');
  });

  it('handleClaim: shows generic error', async () => {
    mockApiClientPut.mockRejectedValue(new Error('Network error'));

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.event).toBeTruthy();
    });

    act(() => { result.current.setGuestName('Test'); });
    await act(async () => { await result.current.handleClaim('g-1', 'Olla'); });

    expect(mockShowToast).toHaveBeenCalledWith('Error al apartar el regalo. Intenta de nuevo.', 'error');
  });

  it('filters gifts by category', async () => {
    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.gifts).toHaveLength(2);
    });

    act(() => { result.current.setCategoryFilter('Cocina'); });

    expect(result.current.filteredGifts).toHaveLength(1);
    expect(result.current.filteredGifts[0].name).toBe('Olla');
  });

  it('returns all available gifts when no category filter', async () => {
    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.availableGifts).toHaveLength(1);
    });
    expect(result.current.filteredGifts).toEqual(result.current.availableGifts);
  });

  it('muestra "hasMore" cuando la primera página llega al tope (B10)', async () => {
    const manyGifts = Array.from({ length: 50 }, (_, i) => ({
      id: `g-${i}`,
      name: `Regalo ${i}`,
      isClaimed: false,
      createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    }));
    mockGetEventBySlug.mockResolvedValue({ event: testEvent, gifts: manyGifts, photos: [] });

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.gifts).toHaveLength(50);
    });
    expect(result.current.giftsHasMore).toBe(true);
    expect(result.current.photosHasMore).toBe(false);
  });

  it('carga más regalos con cursor y los anexa sin duplicados (B10)', async () => {
    const manyGifts = Array.from({ length: 50 }, (_, i) => ({
      id: `g-${i}`,
      name: `Regalo ${i}`,
      isClaimed: false,
      createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    }));
    mockGetEventBySlug.mockResolvedValue({ event: testEvent, gifts: manyGifts, photos: [] });
    mockApiClientGet.mockResolvedValue({
      gifts: [
        { id: 'g-49', name: 'Regalo duplicado', isClaimed: false, createdAt: manyGifts[49].createdAt },
        { id: 'g-50', name: 'Regalo extra', isClaimed: false, createdAt: new Date(2024, 11, 31).toISOString() },
      ],
      hasMore: true,
    });

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.gifts).toHaveLength(50);
    });

    await act(async () => {
      await result.current.loadMoreGifts();
    });

    expect(mockApiClientGet).toHaveBeenCalledWith(
      '/api/events/evt-1/gifts',
      expect.objectContaining({
        params: expect.objectContaining({ limit: '50', cursor: expect.any(String) }),
      }),
    );
    // el regalo duplicado (mismo id) se descarta
    expect(result.current.gifts).toHaveLength(51);
    expect(result.current.gifts[50].id).toBe('g-50');
    expect(result.current.giftsHasMore).toBe(true);
    expect(result.current.loadingMoreGifts).toBe(false);
  });

  it('carga más fotos con cursor (B10)', async () => {
    const manyPhotos = Array.from({ length: 15 }, (_, i) => ({
      id: `p-${i}`,
      url: `https://cdn.test/${i}.jpg`,
      uploadedBy: 'Ana',
      createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    }));
    mockGetEventBySlug.mockResolvedValue({ event: testEvent, gifts: [], photos: manyPhotos });
    mockApiClientGet.mockResolvedValue({ photos: [{ id: 'p-15', url: 'https://cdn.test/15.jpg', uploadedBy: 'Luis', createdAt: new Date(2024, 11, 31).toISOString() }], hasMore: false });

    const { result } = renderEventPageHook();

    await waitFor(() => {
      expect(result.current.photos).toHaveLength(15);
    });
    expect(result.current.photosHasMore).toBe(true);

    await act(async () => {
      await result.current.loadMorePhotos();
    });

    expect(result.current.photos).toHaveLength(16);
    expect(result.current.photosHasMore).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockApiClientGet = vi.hoisted(() => vi.fn());
vi.mock('../services/api', () => ({ apiClient: { get: mockApiClientGet } }));

import GiftManagement from '../components/admin/GiftManagement';
import GuestsPanel from '../components/admin/GuestsPanel';
import MessagesPanel from '../components/admin/MessagesPanel';
import { PhotoGallery } from '../components/admin/PhotoGallery';

afterEach(() => vi.clearAllMocks());

const sampleGifts = [
  { id: 'g-1', name: 'Olla', isClaimed: false, category: 'cocina' },
  { id: 'g-2', name: 'Cobija', isClaimed: true, claimedBy: 'Maria', category: 'bebe' },
];

describe('GiftManagement', () => {
  const defaultProps = {
    gifts: sampleGifts,
    addingGift: false,
    freeingGiftId: null,
    deletingGiftId: null,
    newGiftName: '',
    showSuggestions: false,
    suggestions: ['Sartén', 'Toalla'],
    filteredSuggestions: ['Sartén'],
    maxGiftsPerEvent: 10,
    onAddGift: vi.fn(),
    onFreeGift: vi.fn(),
    onDeleteGift: vi.fn(),
    onAddSuggestion: vi.fn(),
    onNewGiftNameChange: vi.fn(),
    onShowSuggestionsChange: vi.fn(),
  };

  it('renders gift list', () => {
    render(<GiftManagement {...defaultProps} />);
    expect(screen.getByText('Lista de Deseos de Regalos')).toBeTruthy();
  });

  it('shows empty state when no gifts', () => {
    render(<GiftManagement {...defaultProps} gifts={[]} />);
    expect(screen.getByText('No hay regalos de deseos')).toBeTruthy();
  });

  it('calls onAddGift on form submit', () => {
    const onAddGift = vi.fn();
    render(<GiftManagement {...defaultProps} onAddGift={onAddGift} newGiftName="Test" />);
    fireEvent.click(screen.getByTestId('add-gift-button'));
    expect(onAddGift).toHaveBeenCalled();
  });

  it('disables add button when at limit', () => {
    render(<GiftManagement {...defaultProps} gifts={Array.from({ length: 10 }, (_, i) => ({ ...sampleGifts[0], id: `g-${i}`, name: `Gift ${i}` }))} />);
    expect(screen.getByTestId('add-gift-button').hasAttribute('disabled')).toBe(true);
  });

  it('disables add button when input empty', () => {
    render(<GiftManagement {...defaultProps} newGiftName="" />);
    expect(screen.getByTestId('add-gift-button').hasAttribute('disabled')).toBe(true);
  });

  it('shows suggestions dropdown', () => {
    render(<GiftManagement {...defaultProps} showSuggestions={true} newGiftName="Sar" />);
    expect(screen.getByText('+ Sartén')).toBeTruthy();
  });

  it('renders suggestion pills', () => {
    render(<GiftManagement {...defaultProps} gifts={[]} />);
    expect(screen.getByText('Sartén')).toBeTruthy();
  });
});

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('GuestsPanel', () => {
  it('shows loading then renders stats', async () => {
    mockApiClientGet.mockResolvedValue({ guests: [
      { id: '1', name: 'Ana', email: 'ana@t.com', phone: null, isConfirmed: true, companions: 1, dietaryRestrictions: null, message: null, createdAt: '2025-01-01' },
      { id: '2', name: 'Luis', email: 'luis@t.com', phone: null, isConfirmed: false, companions: 0, dietaryRestrictions: null, message: null, createdAt: '2025-01-02' },
    ]});
    renderWithQuery(<GuestsPanel eventId="evt-1" />);
    expect(await screen.findByText('Invitados')).toBeTruthy();
    expect(screen.getByText('1 confirmados · 2 personas')).toBeTruthy();
  });

  it('shows empty state', async () => {
    mockApiClientGet.mockResolvedValue({ guests: [] });
    renderWithQuery(<GuestsPanel eventId="evt-1" />);
    expect(await screen.findByText('No hay invitados aún')).toBeTruthy();
  });
});

describe('MessagesPanel', () => {
  it('shows loading then renders messages', async () => {
    mockApiClientGet.mockResolvedValue({ messages: [
      { id: 'm-1', authorName: 'Ana', message: 'Felicidades!', createdAt: '2025-01-01T12:00:00Z' },
    ]});
    render(<MessagesPanel eventId="evt-1" />);
    expect(await screen.findByText('Felicidades!')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('shows empty state', async () => {
    mockApiClientGet.mockResolvedValue({ messages: [] });
    render(<MessagesPanel eventId="evt-1" />);
    expect(await screen.findByText('Todavía no hay mensajes')).toBeTruthy();
  });
});

describe('PhotoGallery', () => {
  const defaultPhotoProps = {
    photos: [
      { id: 'p-1', url: 'https://cdn.test/photo.jpg', caption: 'Foto 1', uploadedBy: 'Ana', isFeatured: false },
    ],
    uploading: false,
    uploadProgress: null,
    uploadPercent: 0,
    deletingPhoto: false,
    deletePhotoConfirm: null,
    fileInputRef: { current: null } as React.RefObject<HTMLInputElement | null>,
    maxPhotosPerEvent: 15,
    onUpload: vi.fn(),
    onDelete: vi.fn(),
    onRequestDelete: vi.fn(),
    onDeleteConfirmClose: vi.fn(),
    onSelectPreview: vi.fn(),
    selectedPhotoForPreview: null,
  };

  it('renders photo grid', () => {
    render(<PhotoGallery {...defaultPhotoProps} />);
    expect(screen.getByText('Foto 1')).toBeTruthy();
  });

  it('shows empty state', () => {
    render(<PhotoGallery {...defaultPhotoProps} photos={[]} />);
    expect(screen.getByText(/Aún no hay fotografías/)).toBeTruthy();
  });

  it('shows upload progress', () => {
    render(<PhotoGallery {...defaultPhotoProps} uploading={true} uploadPercent={60} />);
    expect(screen.getByText('Subiendo...')).toBeTruthy();
  });

  it('calls onSelectPreview on photo click', () => {
    const onSelectPreview = vi.fn();
    render(<PhotoGallery {...defaultPhotoProps} onSelectPreview={onSelectPreview} />);
    fireEvent.click(screen.getByText('Foto 1').closest('[role="button"]')!);
    expect(onSelectPreview).toHaveBeenCalledWith(defaultPhotoProps.photos[0]);
  });

  it('shows delete confirmation modal', () => {
    render(<PhotoGallery {...defaultPhotoProps} deletePhotoConfirm="p-1" deletingPhoto={false} />);
    expect(screen.getByText(/¿Eliminar esta foto/)).toBeTruthy();
  });

  it('calls onDelete when confirming delete', () => {
    const onDelete = vi.fn();
    render(<PhotoGallery {...defaultPhotoProps} deletePhotoConfirm="p-1" onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(onDelete).toHaveBeenCalledWith('p-1');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GuestPhotoUpload from '../components/GuestPhotoUpload';

const mockApiPost = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  apiClient: { post: mockApiPost },
}));

vi.mock('../hooks/useToast', () => ({
  showToast: mockShowToast,
}));

vi.mock('../hooks/useTurnstile', () => ({ useTurnstile: () => ({ containerRef: { current: null }, token: 'tok-1', reset: vi.fn() }), waitForTurnstile: vi.fn(() => 'tok-1') }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  globalThis.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ url: 'https://example.com/photo.jpg' }),
  });
  mockApiPost.mockResolvedValue({});
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function getFileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]')!;
}

describe('GuestPhotoUpload', () => {
  it('toggles form visibility on button click', () => {
    render(<GuestPhotoUpload eventId="event-1" onUploaded={vi.fn()} />);

    expect(screen.queryByText('Subir foto 📸')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/¿Tomaste fotos/));
    expect(screen.getByText('Subir foto 📸')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cerrar'));
    expect(screen.queryByText('Subir foto 📸')).not.toBeInTheDocument();
  });

  it('shows preview when file is selected', () => {
    const { container } = render(<GuestPhotoUpload eventId="event-1" onUploaded={vi.fn()} />);
    fireEvent.click(screen.getByText(/¿Tomaste fotos/));

    const fileInput = getFileInput(container);
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    expect(URL.createObjectURL).toHaveBeenCalled();
    const preview = screen.getByAltText('Preview');
    expect(preview).toBeInTheDocument();
  });

  it('calls onUploaded after successful upload', async () => {
    const onUploaded = vi.fn();

    const { container } = render(<GuestPhotoUpload eventId="event-1" onUploaded={onUploaded} />);
    fireEvent.click(screen.getByText(/¿Tomaste fotos/));

    const fileInput = getFileInput(container);
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    const uploadBtn = screen.getByText('Subir foto 📸');
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalled();
    });
    expect(onUploaded).toHaveBeenCalled();
  });

  it('shows error toast on upload failure', async () => {
    mockFetch.mockRejectedValue(new Error('Subida fallida'));

    const { container } = render(<GuestPhotoUpload eventId="event-1" onUploaded={vi.fn()} />);
    fireEvent.click(screen.getByText(/¿Tomaste fotos/));

    const fileInput = getFileInput(container);
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByText('Subir foto 📸'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Subida fallida', 'error');
    });
  });
});

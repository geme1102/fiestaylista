import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareButtons from '../components/ShareButtons';

beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(window, 'location', {
    value: { origin: 'https://fiestaylista.com', href: '' },
    writable: true,
  });
});

describe('ShareButtons', () => {
  it('renders with correct URL', () => {
    render(<ShareButtons slug="mi-evento" title="Mi Fiesta" />);
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Copiar Link')).toBeInTheDocument();
  });

  it('opens WhatsApp with encoded URL', () => {
    const open = vi.fn();
    window.open = open;

    render(<ShareButtons slug="mi-evento" title="Mi Fiesta" />);
    fireEvent.click(screen.getByText('WhatsApp'));

    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/?text='),
      '_blank'
    );
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('https://fiestaylista.com/e/mi-evento')),
      '_blank'
    );
  });

  it('copies link to clipboard and shows copied state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ShareButtons slug="mi-evento" title="Mi Fiesta" />);
    fireEvent.click(screen.getByText('Copiar Link'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://fiestaylista.com/e/mi-evento');
    });
    expect(screen.getByText('✅ Copiado')).toBeInTheDocument();
  });

  it('does not show copied state on clipboard error', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ShareButtons slug="mi-evento" title="Mi Fiesta" />);
    fireEvent.click(screen.getByText('Copiar Link'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(screen.queryByText('✅ Copiado')).not.toBeInTheDocument();
  });

  it('M1: invoca onShared al copiar el enlace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onShared = vi.fn();

    render(<ShareButtons slug="mi-evento" title="Mi Fiesta" onShared={onShared} />);
    fireEvent.click(screen.getByText('Copiar Link'));

    await waitFor(() => {
      expect(onShared).toHaveBeenCalledTimes(1);
    });
  });

  it('M1: invoca onShared al compartir por WhatsApp', () => {
    window.open = vi.fn();
    const onShared = vi.fn();

    render(<ShareButtons slug="mi-evento" title="Mi Fiesta" onShared={onShared} />);
    fireEvent.click(screen.getByText('WhatsApp'));

    expect(onShared).toHaveBeenCalledTimes(1);
  });
});

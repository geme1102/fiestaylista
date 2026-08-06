import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RsvpForm from '../components/RsvpForm';

const mockPost = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  apiClient: { post: mockPost },
}));

vi.mock('../hooks/useTurnstile', () => ({ useTurnstile: () => ({ containerRef: { current: null }, token: 'tok-1', reset: vi.fn() }), waitForTurnstile: vi.fn(() => 'tok-1') }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockPost.mockResolvedValue({});
});

describe('RsvpForm', () => {
  it('renders collapsed form initially', () => {
    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="" />);
    expect(screen.getByText(/¿Vienes\?/)).toBeInTheDocument();
    // El grid wrapper tiene grid-rows-[0fr] + opacity-0 cuando colapsado
    const gridWrapper = screen.getByText(/Acompañantes/).closest('[class*="grid"]');
    expect(gridWrapper).toHaveClass('grid-rows-[0fr]');
    expect(gridWrapper).toHaveClass('opacity-0');
  });

  it('opens form on toggle click', () => {
    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="" />);
    fireEvent.click(screen.getByText(/¿Vienes\?/));
    expect(screen.getByLabelText(/Acompañantes/)).toBeInTheDocument();
  });

  it('disables submit when name is empty', () => {
    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="" />);
    fireEvent.click(screen.getByText(/¿Vienes\?/));

    const submitBtn = screen.getByRole('button', { name: /confirmar asistencia/i });
    expect(submitBtn).toBeDisabled();
  });

  it('calls API and shows confirmation on valid submit', async () => {
    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="Maria" />);
    fireEvent.click(screen.getByText(/¿Vienes\?/));

    const submitBtn = screen.getByRole('button', { name: /confirmar asistencia/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/events/event-1/rsvp', expect.objectContaining({ name: 'Maria' }));
    });
    expect(screen.getByText('¡Asistencia confirmada!')).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    mockPost.mockRejectedValue(new Error('Error de conexión'));

    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="Maria" />);
    fireEvent.click(screen.getByText(/¿Vienes\?/));

    const submitBtn = screen.getByRole('button', { name: /confirmar asistencia/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Error de conexión')).toBeInTheDocument();
    });
  });

  it('restaura el draft de mensaje y acompañantes guardado (B8)', () => {
    localStorage.setItem('fy_rsvp_draft:event-1', JSON.stringify({ companions: 3, message: 'Llevo la torta' }));

    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="Maria" />);
    fireEvent.click(screen.getByText(/¿Vienes\?/));

    expect(screen.getByLabelText(/Acompañantes/)).toHaveValue('3');
    expect(screen.getByLabelText(/Mensaje para el anfitrión/)).toHaveValue('Llevo la torta');
  });

  it('guarda el draft al escribir y lo limpia al confirmar (B8)', async () => {
    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="Maria" />);
    fireEvent.click(screen.getByText(/¿Vienes\?/));

    const messageInput = screen.getByLabelText(/Mensaje para el anfitrión/);
    fireEvent.change(messageInput, { target: { value: 'Nos vemos!' } });

    expect(JSON.parse(localStorage.getItem('fy_rsvp_draft:event-1')!)).toEqual({
      companions: 0,
      message: 'Nos vemos!',
    });

    fireEvent.click(screen.getByRole('button', { name: /confirmar asistencia/i }));

    await waitFor(() => {
      expect(localStorage.getItem('fy_rsvp_draft:event-1')).toBeNull();
    });
  });
});

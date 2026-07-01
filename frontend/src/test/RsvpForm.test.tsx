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
  mockPost.mockResolvedValue({});
});

describe('RsvpForm', () => {
  it('renders collapsed form initially', () => {
    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="" />);
    expect(screen.getByText(/¿Vienes\?/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ej: María Pérez')).not.toBeInTheDocument();
  });

  it('opens form on toggle click', () => {
    render(<RsvpForm eventId="event-1" eventTitle="Mi Fiesta" guestName="" />);
    fireEvent.click(screen.getByText(/¿Vienes\?/));
    expect(screen.getByPlaceholderText('Ej: María Pérez')).toBeInTheDocument();
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
});

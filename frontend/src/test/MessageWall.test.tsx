import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessageWall from '../components/MessageWall';

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

vi.mock('../hooks/useTurnstile', () => ({
  useTurnstile: () => ({ containerRef: { current: null }, token: 'tok-1', reset: vi.fn() }),
  waitForTurnstile: vi.fn(() => 'tok-1'),
}));

vi.mock('../hooks/useToast', () => ({
  showToast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGet.mockResolvedValue({ messages: [] });
  mockPost.mockResolvedValue({ message: { id: 'm-1', message: 'Hola', authorName: 'Ana' } });
});

describe('MessageWall (B8 drafts)', () => {
  it('restaura el draft guardado en localStorage', () => {
    localStorage.setItem('fy_msg_draft:event-1', 'Mensaje a medio escribir');

    render(<MessageWall eventId="event-1" guestName="Ana" />);
    fireEvent.click(screen.getByText(/escribe un mensaje/i));

    expect(screen.getByPlaceholderText('Escribe tu mensaje...')).toHaveValue('Mensaje a medio escribir');
  });

  it('persiste el draft al escribir y lo limpia al publicar', async () => {
    render(<MessageWall eventId="event-1" guestName="Ana" />);
    fireEvent.click(screen.getByText(/escribe un mensaje/i));

    const textarea = screen.getByPlaceholderText('Escribe tu mensaje...');
    fireEvent.change(textarea, { target: { value: 'Felicitaciones!' } });

    expect(localStorage.getItem('fy_msg_draft:event-1')).toBe('Felicitaciones!');

    fireEvent.click(screen.getByRole('button', { name: /publicar mensaje/i }));

    await waitFor(() => {
      expect(localStorage.getItem('fy_msg_draft:event-1')).toBeNull();
    });
  });
});

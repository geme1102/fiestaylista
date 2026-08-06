import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockCreateEvent = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/events', () => ({
  createEvent: mockCreateEvent,
  newIdempotencyKey: () => 'e3b0c442-98fc-1c14-9afc-4cfc6daf0a01',
}));
vi.mock('../hooks/useToast', () => ({ showToast: mockShowToast }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import Onboarding from '../pages/Onboarding';

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { name: 'Ana', tier: 'free' } });
  mockCreateEvent.mockResolvedValue({ id: 'evt-1' });
});

describe('Onboarding', () => {
  it('renders step 1 with event type selection', () => {
    renderOnboarding();
    expect(screen.getByText('¿Qué tipo de evento?')).toBeTruthy();
    expect(screen.getByText('Boda')).toBeTruthy();
    expect(screen.getByText('Baby Shower')).toBeTruthy();
  });

  it('advances to step 2 after selecting event type', () => {
    renderOnboarding();
    fireEvent.click(screen.getByText('Boda'));
    fireEvent.click(screen.getByText('Continuar'));
    expect(screen.getByText(/¿Cómo se llama tu evento/)).toBeTruthy();
  });

  it('creates event and navigates to dashboard', async () => {
    renderOnboarding();
    fireEvent.click(screen.getByText('Boda'));
    fireEvent.click(screen.getByText('Continuar'));
    const input = screen.getByPlaceholderText(/boda de/i);
    fireEvent.change(input, { target: { value: 'Mi Boda' } });
    fireEvent.click(screen.getByText(/Crear mi/i));
    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mi Boda', eventType: 'WEDDING' }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('disables create button when title is empty', () => {
    renderOnboarding();
    fireEvent.click(screen.getByText('Boda'));
    fireEvent.click(screen.getByText('Continuar'));
    expect(screen.getByText(/Crear mi/i).closest('button')?.disabled).toBe(true);
  });

  it('skip button navigates to dashboard', () => {
    renderOnboarding();
    fireEvent.click(screen.getByText('Saltar este paso'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('A3: Enter repetido no duplica la creación del evento', async () => {
    mockCreateEvent.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ id: 'evt-1' }), 50)));
    renderOnboarding();
    fireEvent.click(screen.getByText('Boda'));
    fireEvent.click(screen.getByText('Continuar'));
    const input = screen.getByPlaceholderText(/boda de/i);
    fireEvent.change(input, { target: { value: 'Mi Boda' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
  });
});

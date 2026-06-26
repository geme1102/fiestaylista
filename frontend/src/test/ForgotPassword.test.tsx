import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockShowToast = vi.hoisted(() => vi.fn());
const mockApiClientPost = vi.hoisted(() => vi.fn());
const mockTurnstile = vi.hoisted(() => ({ containerRef: { current: null }, token: null, ready: true, error: null }));

vi.mock('../hooks/useToast', () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));
vi.mock('../services/api', () => ({ apiClient: { post: (...args: unknown[]) => mockApiClientPost(...args) } }));
vi.mock('../hooks/useTurnstile', () => ({ useTurnstile: () => mockTurnstile }));
vi.mock('../components/LoadingSpinner', () => ({ default: () => <div data-testid="loading-spinner" /> }));
vi.mock('../components/AuthBottomNav', () => ({ default: () => <div data-testid="auth-bottom-nav" /> }));
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import ForgotPassword from '../pages/ForgotPassword';

beforeEach(() => {
  vi.clearAllMocks();
  mockTurnstile.token = null;
  mockApiClientPost.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  );
}

describe('ForgotPassword', () => {
  it('renders form with email field', () => {
    renderPage();
    expect(screen.getByText('Recuperar Contraseña')).toBeTruthy();
    expect(screen.getByPlaceholderText('tu@correo.com')).toBeTruthy();
    expect(screen.getByText('Enviar enlace')).toBeTruthy();
  });

  it('shows error when submitting empty email', () => {
    renderPage();
    fireEvent.click(screen.getByText('Enviar enlace'));
    expect(mockShowToast).toHaveBeenCalledWith('Ingresa tu correo electrónico', 'error');
  });

  it('shows success state after submitting email', async () => {
    mockTurnstile.token = 'mock-token';
    mockApiClientPost.mockResolvedValue({});
    renderPage();
    const input = screen.getByPlaceholderText('tu@correo.com');
    fireEvent.change(input, { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByText('Enviar enlace'));
    await waitFor(() => {
      expect(mockApiClientPost).toHaveBeenCalledWith('/api/auth/forgot-password', expect.objectContaining({ email: 'user@test.com' }));
    });
    expect(screen.getByText('Revisa tu bandeja de entrada')).toBeTruthy();
    expect(screen.getByText('Volver a iniciar sesión')).toBeTruthy();
  });

  it('renders AuthBottomNav and back to login link', () => {
    renderPage();
    expect(screen.getByTestId('auth-bottom-nav')).toBeTruthy();
    expect(screen.getAllByText('Volver a iniciar sesión').length).toBeGreaterThanOrEqual(1);
  });
});

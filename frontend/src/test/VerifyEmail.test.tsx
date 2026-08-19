import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockApiClientPost = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseSearchParams = vi.hoisted(() => vi.fn(() => [new URLSearchParams(), vi.fn()]));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/api', () => ({ apiClient: { post: (...args: unknown[]) => mockApiClientPost(...args) } }));
vi.mock('../hooks/useToast', () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));
vi.mock('../components/AuthBottomNav', () => ({ default: () => <div data-testid="auth-bottom-nav" /> }));
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useSearchParams: () => mockUseSearchParams() };
});

import VerifyEmail from '../pages/VerifyEmail';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ refreshUser: vi.fn().mockResolvedValue(undefined), resendVerification: vi.fn().mockResolvedValue(undefined) });
  mockUseSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
  mockApiClientPost.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <VerifyEmail />
    </MemoryRouter>
  );
}

describe('VerifyEmail', () => {
  it('shows verifying state initially', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('?token=abc123'), vi.fn()]);
    renderPage();
    expect(screen.getByText('Verificando correo...')).toBeTruthy();
  });

  it('shows success with countdown when status=success', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('?status=success'), vi.fn()]);
    renderPage();
    expect(screen.getByText('¡Correo Verificado!')).toBeTruthy();
    expect(screen.getByText('Ir al Dashboard')).toBeTruthy();
    expect(screen.getByText(/serás redirigido/i)).toBeTruthy();
    expect(screen.getByText(/3 segundos/i)).toBeTruthy();
  });

  it('shows error with resend button when token is missing', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    renderPage();
    expect(screen.getByText('Error de Verificación')).toBeTruthy();
    expect(screen.getByText('Reenviar verificación')).toBeTruthy();
  });

  it('calls resendVerification on resend button click', async () => {
    const resendVerification = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ refreshUser: vi.fn(), resendVerification });
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    renderPage();
    fireEvent.click(screen.getByText('Reenviar verificación'));
    await waitFor(() => {
      expect(resendVerification).toHaveBeenCalled();
    });
  });

  it('renders AuthBottomNav', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('?status=success'), vi.fn()]);
    renderPage();
    expect(screen.getByTestId('auth-bottom-nav')).toBeTruthy();
  });

  it('refresca el usuario al llegar con status=success (LF-01)', async () => {
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ refreshUser, resendVerification: vi.fn() });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('?status=success'), vi.fn()]);

    renderPage();

    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalled();
    });
  });
});

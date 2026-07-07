import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockTurnstileToken = vi.fn((): string | null => null);

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, isAuthenticated: false, isLoading: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../hooks/useTurnstile', () => ({
  useTurnstile: () => ({ containerRef: { current: null }, token: mockTurnstileToken(), error: null, reset: vi.fn() }),
}));

vi.mock('../hooks/useToast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Cargando...</div>,
}));

vi.mock('../components/NavbarPremium', () => ({
  default: () => <nav data-testid="navbar-premium" />,
}));

vi.mock('../components/AuthBottomNav', () => ({
  default: () => <div data-testid="auth-bottom-nav" />,
}));

import Login from '../pages/Login';
import { showToast } from '../hooks/useToast';

beforeEach(() => {
  vi.clearAllMocks();
  mockTurnstileToken.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderLogin() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function submitForm() {
  const form = document.querySelector('form')!;
  fireEvent.submit(form);
}

describe('Login page', () => {
  it('renders login form with email and password fields', () => {
    renderLogin();

    expect(screen.getByPlaceholderText('tu@correo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('shows error when fields are empty', async () => {
    renderLogin();
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Completa todos los campos', 'error');
    });
  });

  it('calls login and navigates to dashboard on success', async () => {
    mockLogin.mockResolvedValue({ user: { id: '1', emailVerified: true }, accessToken: 'tok' });
    mockTurnstileToken.mockReturnValue('tok-123');

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'MyPass1' } });
    submitForm();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'MyPass1', 'tok-123');
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    }, { timeout: 2000 });
  });

  it('shows info toast when email is not verified', async () => {
    mockLogin.mockResolvedValue({ user: { id: '1', emailVerified: false }, accessToken: 'tok' });
    mockTurnstileToken.mockReturnValue('tok-123');

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'MyPass1' } });
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('correo aún no está verificado'),
        'info'
      );
    });
  });

  it('shows error on invalid credentials', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    mockTurnstileToken.mockReturnValue('tok');

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        'Credenciales inválidas. Verifica tu correo y contraseña e intenta de nuevo.',
        'error'
      );
    });
  });

  it('navigates to redirect param when provided', async () => {
    delete (window as any).location;
    (window as any).location = { origin: 'http://localhost', search: '?redirect=/events/evt-1', href: '' };

    mockLogin.mockResolvedValue({ user: { id: '1', emailVerified: true }, accessToken: 'tok' });
    mockTurnstileToken.mockReturnValue('tok');

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'MyPass1' } });
    submitForm();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/evt-1', { replace: true });
    });
  });

  it('renders navbar and bottom nav', () => {
    renderLogin();

    expect(screen.getByTestId('navbar-premium')).toBeInTheDocument();
    expect(screen.getByTestId('auth-bottom-nav')).toBeInTheDocument();
  });
});

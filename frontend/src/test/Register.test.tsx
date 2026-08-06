import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();
const mockTurnstileToken = vi.fn((): string | null => null);

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister, isAuthenticated: false, isLoading: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../hooks/useTurnstile', () => ({
  useTurnstile: () => ({ containerRef: { current: null }, token: mockTurnstileToken(), reset: vi.fn() }),
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

import Register from '../pages/Register';
import { showToast } from '../hooks/useToast';

beforeEach(() => {
  vi.clearAllMocks();
  mockTurnstileToken.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderRegister() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function submitForm() {
  const form = document.querySelector('form')!;
  fireEvent.submit(form);
}

function fillName(v: string) { fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: v } }); }
function fillEmail(v: string) { fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: v } }); }
function fillPassword(v: string) { fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: v } }); }
function checkTerms() { fireEvent.click(document.getElementById('accept-terms')!); }
function checkPrivacy() { fireEvent.click(document.getElementById('accept-privacy')!); }

describe('Register page', () => {
  it('renders registration form with all fields', () => {
    renderRegister();

    expect(screen.getByPlaceholderText('Tu nombre')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('tu@correo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /empezar gratis/i })).toBeInTheDocument();
  });

  it('shows error when fields are empty on submit', async () => {
    renderRegister();
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Completa todos los campos', 'error');
    });
  });

  it('shows error for short password', async () => {
    renderRegister();
    fillName('Test User');
    fillEmail('test@test.com');
    fillPassword('Ab1');
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('La contraseña debe tener al menos 8 caracteres', 'error');
    });
  });

  it('requires uppercase letter in password', async () => {
    renderRegister();
    fillName('Test User');
    fillEmail('test@test.com');
    fillPassword('abcdefgh1');
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('La contraseña debe contener al menos una mayúscula', 'error');
    });
  });

  it('requires number in password', async () => {
    renderRegister();
    fillName('Test User');
    fillEmail('test@test.com');
    fillPassword('Abcdefgh');
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('La contraseña debe contener al menos un número', 'error');
    });
  });

  it('requires terms and privacy acceptance', async () => {
    renderRegister();
    fillName('Test User');
    fillEmail('test@test.com');
    fillPassword('Abcdefgh1');
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Debes aceptar los términos y la política de privacidad', 'error');
    });
  });

  it('calls register and navigates on successful submit', async () => {
    mockRegister.mockResolvedValue({ user: { id: '1' }, accessToken: 'tok', refreshToken: '' });
    mockTurnstileToken.mockReturnValue('turnstile-token');

    renderRegister();
    fillName('Test User');
    fillEmail('test@test.com');
    fillPassword('Abcdefgh1');
    checkTerms();
    checkPrivacy();
    fireEvent.click(screen.getByRole('button', { name: /empezar gratis/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@test.com', 'Abcdefgh1', 'Test User', 'turnstile-token');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true });
  });

  it('shows error toast when register API fails', async () => {
    mockRegister.mockRejectedValue(new Error('Email already exists'));
    mockTurnstileToken.mockReturnValue('tok');

    renderRegister();
    fillName('Test User');
    fillEmail('test@test.com');
    fillPassword('Abcdefgh1');
    checkTerms();
    checkPrivacy();
    fireEvent.click(screen.getByRole('button', { name: /empezar gratis/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Email already exists', 'error');
    });
  });

  it('shows password strength bar as user types', () => {
    renderRegister();

    fillPassword('Abcdefgh1!');

    expect(screen.getByText('Fuerte')).toBeInTheDocument();
  });

  it('renders navbar and bottom nav', () => {
    renderRegister();

    expect(screen.getByTestId('navbar-premium')).toBeInTheDocument();
    expect(screen.getByTestId('auth-bottom-nav')).toBeInTheDocument();
  });

  it('no se queda atascado tras un submit con campos vacíos (B3)', async () => {
    renderRegister();
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Completa todos los campos', 'error');
    });

    // Segundo submit vacío: antes quedaba muerto porque submittingRef
    // se seteaba ANTES de las validaciones y los early-returns no lo limpiaban.
    submitForm();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledTimes(2);
    });
  });

  it('sigue funcionando después de un submit inválido (B3)', async () => {
    mockRegister.mockResolvedValue({ user: { id: '1' }, accessToken: 'tok', refreshToken: '' });
    mockTurnstileToken.mockReturnValue('tok');

    renderRegister();
    submitForm();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Completa todos los campos', 'error');
    });

    fillName('Test User');
    fillEmail('test@test.com');
    fillPassword('Abcdefgh1');
    checkTerms();
    checkPrivacy();
    submitForm();

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@test.com', 'Abcdefgh1', 'Test User', 'tok');
    });
  });
});

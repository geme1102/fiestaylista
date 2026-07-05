import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockCreateCheckoutSession = vi.hoisted(() => vi.fn());
const mockShowToast = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseLocation = vi.hoisted(() => vi.fn(() => ({ search: '' })));
const mockTurnstileReturn = vi.hoisted(() => ({ containerRef: { current: null }, token: null, ready: true, error: null }));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/mercadopago', () => ({ createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args) }));
vi.mock('../hooks/useToast', () => ({ showToast: (...args: unknown[]) => mockShowToast(...args) }));
vi.mock('../hooks/useTurnstile', () => ({ useTurnstile: () => mockTurnstileReturn }));
vi.mock('../components/NavbarPremium', () => ({ default: () => <nav data-testid="navbar-premium" /> }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useLocation: () => mockUseLocation() };
});

import Pricing from '../pages/Pricing';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false });
  mockTurnstileReturn.containerRef = { current: null };
  mockTurnstileReturn.token = null;
  mockTurnstileReturn.ready = true;
  mockTurnstileReturn.error = null;
  mockUseLocation.mockReturnValue({ search: '' });
});

afterEach(() => vi.restoreAllMocks());

function renderPricing() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('Pricing', () => {
  it('renders page title and subtitle', () => {
    renderPricing();
    expect(screen.getByText('Elige el plan perfecto para tu celebración')).toBeTruthy();
    expect(screen.getByText(/Empieza gratis, actualiza cuando lo necesites/)).toBeTruthy();
  });

  it('renders both pricing cards', () => {
    renderPricing();
    expect(screen.getByText('Gratis')).toBeTruthy();
    expect(screen.getByText('Pro')).toBeTruthy();
  });

  it('shows monthly by default', () => {
    renderPricing();
    expect(screen.getByText('$0')).toBeTruthy();
    expect(screen.getByText('$59.900')).toBeTruthy();
  });

  it('toggles to yearly pricing', () => {
    renderPricing();
    fireEvent.click(screen.getByTestId('pricing-toggle-yearly'));
    expect(screen.getByText('$660.000')).toBeTruthy();
  });

  it('shows badge on Pro card', () => {
    renderPricing();
    expect(screen.getByText('MÁS ELEGIDO')).toBeTruthy();
  });

  it('shows Plan Actual when user has that tier', () => {
    mockUseAuth.mockReturnValue({ user: { tier: 'free', name: 'Ana' }, isAuthenticated: true, isLoading: false });
    renderPricing();
    expect(screen.getAllByText('Plan Actual').length).toBeGreaterThanOrEqual(1);
  });

  it('Empezar Gratis redirects to register when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false });
    renderPricing();
    fireEvent.click(screen.getByTestId('cta-free'));
    expect(mockNavigate).toHaveBeenCalledWith('/register?plan=free');
  });

  it('Actualizar a Pro redirects to register when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false });
    renderPricing();
    fireEvent.click(screen.getByTestId('cta-pro'));
    expect(mockNavigate).toHaveBeenCalledWith('/register?plan=pro');
  });

  it('shows toast on payment pending', () => {
    mockUseLocation.mockReturnValue({ search: '?payment=pending' });
    renderPricing();
    expect(mockShowToast).toHaveBeenCalledWith(
      'El pago está pendiente de confirmación. Te notificaremos cuando se complete.',
      'info'
    );
  });

  it('renders FAQ section', () => {
    renderPricing();
    expect(screen.getByText('Preguntas Frecuentes')).toBeTruthy();
    expect(screen.getByText('¿Cómo retiro el dinero que me den los invitados?')).toBeTruthy();
  });

  it('toggles FAQ answer on click', () => {
    renderPricing();
    const faqQuestion = screen.getByText('¿Cómo retiro el dinero que me den los invitados?');
    fireEvent.click(faqQuestion.closest('[class*="glass-card"]')!);
    expect(screen.getByText(/transferencia directa/)).toBeTruthy();
  });
});

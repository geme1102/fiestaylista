import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import NavbarPremium from '../components/NavbarPremium';

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollY = 0;
});

function renderNavbar(props: Parameters<typeof NavbarPremium>[0] = {}) {
  return render(
    <MemoryRouter>
      <NavbarPremium {...props} />
    </MemoryRouter>
  );
}

describe('NavbarPremium', () => {
  it('shows login and register links when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, logout: vi.fn() });
    renderNavbar();

    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.getByText('Crear Lista Gratis')).toBeTruthy();
  });

  it('shows dashboard link and logout when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, logout: vi.fn() });
    renderNavbar();

    expect(screen.getByTestId('dashboard-link')).toBeTruthy();
    expect(screen.getByTestId('logout-button')).toBeTruthy();
  });

  it('hides CTA buttons when hideCta is true', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, logout: vi.fn() });
    renderNavbar({ hideCta: true });

    expect(screen.queryByText('Entrar')).toBeNull();
    expect(screen.queryByText('Crear Lista Gratis')).toBeNull();
  });

  it('renders logo and brand name', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, logout: vi.fn() });
    renderNavbar();

    expect(screen.getByAltText('Fiesta y Lista')).toBeTruthy();
    expect(screen.getByText('Fiesta y Lista')).toBeTruthy();
  });

  it('has testid navbar', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, logout: vi.fn() });
    renderNavbar();

    expect(screen.getByTestId('navbar')).toBeTruthy();
  });

  it('starts with h-20 when scrolled is false', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, logout: vi.fn() });
    renderNavbar();

    expect(screen.getByTestId('navbar').className).toContain('h-20');
  });
});

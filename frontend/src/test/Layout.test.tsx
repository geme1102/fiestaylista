import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import Layout from '../components/Layout';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { name: 'Ana', tier: 'free' }, logout: vi.fn() });
});

function renderLayout(initialRoute = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
          <Route path="/pricing" element={<div data-testid="pricing-page">Pricing</div>} />
          <Route path="/account" element={<div data-testid="account-page">Account</div>} />
          <Route path="/statistics" element={<div data-testid="statistics-page">Statistics</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Layout', () => {
  it('renders logo and brand name', () => {
    renderLayout();
    expect(screen.getByLabelText('Ir al inicio')).toBeTruthy();
    expect(screen.getByText('Fiesta y Lista')).toBeTruthy();
  });

  it('renders desktop nav items for free tier', () => {
    renderLayout();
    expect(screen.getAllByText('Mis Eventos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Planes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mi Cuenta').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Estadísticas')).toBeNull();
  });

  it('shows Statistics nav item for pro tier', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Ana', tier: 'pro' }, logout: vi.fn() });
    renderLayout();
    expect(screen.getAllByText('Estadísticas').length).toBeGreaterThanOrEqual(1);
  });

  it('highlights active nav link', () => {
    renderLayout('/pricing');
    const pricingLinks = screen.getAllByText('Planes');
    const desktopLink = pricingLinks[0].closest('a');
    expect(desktopLink?.className).toContain('bg-primary/10');
  });

  it('renders user name', () => {
    renderLayout();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('renders outlet content', () => {
    renderLayout();
    expect(screen.getByTestId('dashboard-page')).toBeTruthy();
  });

  it('calls logout when Salir is clicked', () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue({ user: { name: 'Ana', tier: 'free' }, logout });
    renderLayout();

    fireEvent.click(screen.getAllByText('Salir')[0]);
    expect(logout).toHaveBeenCalled();
  });

  it('toggles mobile menu', () => {
    renderLayout();
    const menuBtn = screen.getByLabelText('Menú');
    fireEvent.click(menuBtn);
    const salirButtons = screen.getAllByText('Salir');
    expect(salirButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders footer with legal links', () => {
    renderLayout();
    expect(screen.getByText('Términos')).toBeTruthy();
    expect(screen.getByText('Privacidad')).toBeTruthy();
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.getByText('ARCO')).toBeTruthy();
  });

  it('renders bottom mobile nav with icons', () => {
    renderLayout();
    const icons = document.querySelectorAll('.material-symbols-outlined');
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });
});

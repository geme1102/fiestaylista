import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../components/SplashIntro', () => ({
  default: () => <div data-testid="splash-intro">Splash</div>,
}));
vi.mock('../components/QueryProvider', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock('../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../components/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../components/WebviewBanner', () => ({ default: () => null }));
vi.mock('../components/OfflineBanner', () => ({ default: () => null }));
vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
vi.mock('../lib/reportError', () => ({ reportError: vi.fn() }));
vi.mock('../pages/EventGuest', () => ({ default: () => <div>Evento invitado</div> }));

import App from '../App';

describe('App - splash (D1-C2)', () => {
  beforeAll(() => {
    window.scrollTo = vi.fn();
  });

  it('en /e/:slug NO muestra el splash en primera visita (loop viral sin bloqueo)', async () => {
    localStorage.removeItem('splash_seen');
    render(
      <MemoryRouter initialEntries={['/e/test-event']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('splash-intro')).toBeNull();
    expect(await screen.findByText('Evento invitado')).toBeTruthy();
  });

  it('en /login SÍ muestra el splash en primera visita', () => {
    localStorage.removeItem('splash_seen');
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('splash-intro')).toBeTruthy();
  });

  it('en /e/:slug no muestra el splash aunque splash_seen no exista (sin mutar localStorage)', async () => {
    localStorage.removeItem('splash_seen');
    render(
      <MemoryRouter initialEntries={['/e/otro-evento']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Evento invitado')).toBeTruthy();
    expect(localStorage.getItem('splash_seen')).toBeNull();
  });
});

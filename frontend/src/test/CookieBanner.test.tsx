import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import CookieBanner from '../components/CookieBanner';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieBanner />
    </MemoryRouter>
  );
}

describe('CookieBanner', () => {
  it('renders cookie banner when no consent stored', () => {
    renderBanner();
    expect(screen.getByText(/usamos cookies/i)).toBeTruthy();
    expect(screen.getByText('Aceptar todas')).toBeTruthy();
    expect(screen.getByText('Rechazar')).toBeTruthy();
  });

  it('does not render banner when consent already stored', () => {
    localStorage.setItem('cookie_consent_v1', JSON.stringify({ essential: true, analytics: true, preferences: true }));
    renderBanner();
    expect(screen.queryByText(/usamos cookies/i)).toBeNull();
  });

  it('accepts all cookies', () => {
    renderBanner();
    fireEvent.click(screen.getByText('Aceptar todas'));
    const stored = localStorage.getItem('cookie_consent_v1');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.analytics).toBe(true);
    expect(parsed.preferences).toBe(true);
  });

  it('accepts only essential cookies via Rechazar', () => {
    renderBanner();
    fireEvent.click(screen.getByText('Rechazar'));
    const stored = localStorage.getItem('cookie_consent_v1');
    const parsed = JSON.parse(stored!);
    expect(parsed.analytics).toBe(false);
    expect(parsed.preferences).toBe(false);
    expect(parsed.essential).toBe(true);
  });

  it('opens configuration panel', () => {
    renderBanner();
    fireEvent.click(screen.getByText('Configurar'));
    expect(screen.getByText('Configuración de Privacidad')).toBeTruthy();
    expect(screen.getByText('Guardar configuración')).toBeTruthy();
  });

  it('saves preferences from configuration panel', () => {
    renderBanner();
    fireEvent.click(screen.getByText('Configurar'));
    const analyticsCheckbox = screen.getByLabelText(/entender cómo usas/i) as HTMLInputElement;
    expect(analyticsCheckbox.checked).toBe(false);
    fireEvent.click(analyticsCheckbox);
    fireEvent.click(screen.getByText('Guardar configuración'));
    const stored = localStorage.getItem('cookie_consent_v1');
    const parsed = JSON.parse(stored!);
    expect(parsed.analytics).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import PrivacyPolicy from '../pages/PrivacyPolicy';
import TermsConditions from '../pages/TermsConditions';
import CookiesPolicy from '../pages/CookiesPolicy';

function renderPage(Component: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PrivacyPolicy', () => {
  it('renders Spanish content by default', () => {
    renderPage(PrivacyPolicy);
    expect(screen.getByText('Política de Privacidad')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('toggles to English and back', () => {
    renderPage(PrivacyPolicy);
    fireEvent.click(screen.getByText('English'));
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Español')).toBeTruthy();
    fireEvent.click(screen.getByText('Español'));
    expect(screen.getByText('Política de Privacidad')).toBeTruthy();
  });
});

describe('TermsConditions', () => {
  it('renders Spanish content by default', () => {
    renderPage(TermsConditions);
    expect(screen.getByText('Términos y Condiciones')).toBeTruthy();
  });

  it('toggles to English', () => {
    renderPage(TermsConditions);
    fireEvent.click(screen.getByText('English'));
    expect(screen.getByText('Terms and Conditions')).toBeTruthy();
  });
});

describe('CookiesPolicy', () => {
  it('renders Spanish content by default', () => {
    renderPage(CookiesPolicy);
    expect(screen.getByText('Política de Cookies')).toBeTruthy();
  });

  it('toggles to English', () => {
    renderPage(CookiesPolicy);
    fireEvent.click(screen.getByText('English'));
    expect(screen.getByText('Cookies Policy')).toBeTruthy();
  });
});

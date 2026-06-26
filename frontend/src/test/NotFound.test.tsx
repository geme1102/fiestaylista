import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import NotFound from '../pages/NotFound';

function renderNotFound() {
  return render(
    <MemoryRouter initialEntries={['/nonexistent']}>
      <Routes>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotFound', () => {
  it('shows 404 and link to home when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderNotFound();
    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('Página no encontrada')).toBeTruthy();
    expect(screen.getByText('Volver al inicio')).toBeTruthy();
  });

  it('shows link to dashboard when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    renderNotFound();
    expect(screen.getByText('Ir al Dashboard')).toBeTruthy();
  });
});

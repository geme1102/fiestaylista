import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import ErrorBoundary from '../components/ErrorBoundary';

const ProblemChild = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) throw new Error('Test error');
  return <div>Todo bien</div>;
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><ProblemChild /></ErrorBoundary>);
    expect(screen.getByText('Todo bien')).toBeTruthy();
  });

  it('renders error UI when child throws', () => {
    render(<ErrorBoundary><ProblemChild shouldThrow /></ErrorBoundary>);
    expect(screen.getByText('Algo salió mal')).toBeTruthy();
    expect(screen.getByText('Intentar de nuevo')).toBeTruthy();
    expect(screen.getByText('Recargar página')).toBeTruthy();
  });

  it('retry button is rendered', () => {
    render(<ErrorBoundary><ProblemChild shouldThrow /></ErrorBoundary>);
    const btn = screen.getByText('Intentar de nuevo');
    expect(btn).toBeTruthy();
  });
});

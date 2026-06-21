import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('debería mostrar el texto por defecto en fullScreen', () => {
    render(<LoadingSpinner fullScreen />);
    expect(screen.getByText('Cargando momentos especiales...')).toBeInTheDocument();
  });

  it('debería mostrar texto personalizado', () => {
    render(<LoadingSpinner fullScreen text="Cargando eventos..." />);
    expect(screen.getByText('Cargando eventos...')).toBeInTheDocument();
  });

  it('debería renderizar tamaño sm sin body overflow hidden', () => {
    render(<LoadingSpinner size="sm" />);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('debería bloquear scroll en fullScreen', () => {
    render(<LoadingSpinner fullScreen />);
    expect(document.body.style.overflow).toBe('hidden');
  });
});

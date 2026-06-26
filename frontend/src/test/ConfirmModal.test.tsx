import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../components/ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    message: '¿Estás seguro de eliminar este regalo?',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders message and buttons', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('¿Estás seguro de eliminar este regalo?')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-cancel')).toBeInTheDocument();
  });

  it('shows warning icon by default', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('warning', { selector: '.material-symbols-outlined' })).toBeInTheDocument();
  });

  it('hides warning icon when destructive is false', () => {
    render(<ConfirmModal {...defaultProps} destructive={false} />);
    expect(screen.queryByText('warning', { selector: '.material-symbols-outlined' })).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop click', () => {
    render(<ConfirmModal {...defaultProps} />);
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when loading', () => {
    render(<ConfirmModal {...defaultProps} loading={true} />);
    expect(screen.getByTestId('confirm-confirm')).toBeDisabled();
    expect(screen.getByTestId('confirm-cancel')).toBeDisabled();
  });

  it('shows custom confirm label', () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="Archivar" />);
    expect(screen.getByText('Archivar')).toBeInTheDocument();
  });
});

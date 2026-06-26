import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useFocusTrap } from '../hooks/useFocusTrap';

function TestComponent({ active }: { active: boolean }) {
  const ref = useFocusTrap(active);
  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn-first">First</button>
      <button data-testid="btn-middle">Middle</button>
      <button data-testid="btn-last">Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses first element when activated', () => {
    render(<TestComponent active={true} />);
    expect(document.activeElement).toBe(screen.getByTestId('btn-first'));
  });

  it('does not focus when inactive', () => {
    render(<TestComponent active={false} />);
    expect(document.activeElement).not.toBe(screen.getByTestId('btn-first'));
  });

  it('wraps Tab from last to first', () => {
    render(<TestComponent active={true} />);
    screen.getByTestId('btn-last').focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId('btn-first'));
  });

  it('wraps Shift+Tab from first to last', () => {
    render(<TestComponent active={true} />);
    screen.getByTestId('btn-first').focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId('btn-last'));
  });

  it('does not prevent default on Escape', () => {
    render(<TestComponent active={true} />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('restores focus on cleanup', () => {
    const outside = document.createElement('button');
    outside.setAttribute('data-testid', 'outside');
    document.body.appendChild(outside);
    outside.focus();

    const { unmount } = render(<TestComponent active={true} />);
    unmount();

    expect(document.activeElement).toBe(outside);
  });
});

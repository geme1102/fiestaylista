import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/ui/Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Pro</Badge>);
    expect(screen.getByText('Pro')).toBeTruthy();
  });

  it('applies variant styles', () => {
    const { container } = render(<Badge variant="primary">Primary</Badge>);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('bg-primary/10');
  });

  it('renders icon when provided', () => {
    render(<Badge icon="star">Star</Badge>);
    const icon = document.querySelector('.material-symbols-outlined');
    expect(icon?.textContent).toBe('star');
  });

  it('uses sm size', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('text-[11px]');
  });

  it('renders as motion span when animated', () => {
    const { container } = render(<Badge animated>Animated</Badge>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('inline-block');
  });

  it('shows neutral variant by default', () => {
    const { container } = render(<Badge>Default</Badge>);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('bg-surface-container-high');
  });
});

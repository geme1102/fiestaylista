import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('applies primary variant by default', () => {
    const { container } = render(<Button>Primary</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain('bg-gradient-to-r from-primary');
  });

  it('applies size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain('min-h-[52px]');
  });

  it('shows spinner when loading', () => {
    const { container } = render(<Button loading>Loading</Button>);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('disables button when loading', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('disables button when disabled prop', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('applies fullWidth class', () => {
    const { container } = render(<Button fullWidth>Full</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain('w-full');
  });

  it('renders left icon', () => {
    render(<Button leftIcon={<span data-testid="left-icon">*</span>}>With Icon</Button>);
    expect(screen.getByTestId('left-icon')).toBeTruthy();
  });

  it('renders right icon', () => {
    render(<Button rightIcon={<span data-testid="right-icon">*</span>}>With Icon</Button>);
    expect(screen.getByTestId('right-icon')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies destructive variant', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain('bg-red-600');
  });

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain('custom-class');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Logo from '../components/Logo';

describe('Logo', () => {
  it('renders image with decorative alt by default', () => {
    render(<Logo />);
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('/logo.png');
    expect(img!.getAttribute('alt')).toBe('');
  });

  it('renders webp source', () => {
    render(<Logo />);
    const source = document.querySelector('source');
    expect(source?.getAttribute('srcSet')).toBe('/logo.webp');
    expect(source?.getAttribute('type')).toBe('image/webp');
  });

  it('applies custom className', () => {
    render(<Logo className="w-20 h-20" />);
    const img = document.querySelector('img');
    expect(img?.className).toContain('w-20');
  });

  it('accepts custom alt text', () => {
    render(<Logo alt="Fiesta y Lista" />);
    const img = screen.getByAltText('Fiesta y Lista');
    expect(img).toBeTruthy();
  });
});

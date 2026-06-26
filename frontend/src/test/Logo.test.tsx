import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Logo from '../components/Logo';

describe('Logo', () => {
  it('renders image with alt text', () => {
    render(<Logo />);
    const img = screen.getByAltText('Fiesta y Lista');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/logo.png');
  });

  it('renders webp source', () => {
    render(<Logo />);
    const source = document.querySelector('source');
    expect(source?.getAttribute('srcSet')).toBe('/logo.webp');
    expect(source?.getAttribute('type')).toBe('image/webp');
  });

  it('applies custom className', () => {
    render(<Logo className="w-20 h-20" />);
    expect(screen.getByAltText('Fiesta y Lista').className).toContain('w-20');
  });
});

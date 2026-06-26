import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, SkeletonText, SkeletonCard } from '../components/ui/Skeleton';

describe('Skeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('animate-pulse');
  });
});

describe('SkeletonText', () => {
  it('renders default 3 lines', () => {
    const { container } = render(<SkeletonText />);
    const items = container.querySelectorAll('.animate-pulse');
    expect(items.length).toBe(3);
  });

  it('renders custom number of lines', () => {
    const { container } = render(<SkeletonText lines={5} />);
    const items = container.querySelectorAll('.animate-pulse');
    expect(items.length).toBe(5);
  });
});

describe('SkeletonCard', () => {
  it('renders all sections', () => {
    const { container } = render(<SkeletonCard />);
    const items = container.querySelectorAll('.animate-pulse');
    expect(items.length).toBe(6);
  });
});

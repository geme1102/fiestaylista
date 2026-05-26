import { describe, it, expect } from 'vitest';
import { cn } from '../utils/cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

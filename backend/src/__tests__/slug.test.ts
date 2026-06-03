import { describe, it, expect } from 'vitest';
import { generateSlug, generateUniqueSlug } from '../utils/slug.js';

describe('generateSlug', () => {
  it('converts title to lowercase slug', () => {
    const slug = generateSlug('Baby Shower de María');
    expect(slug).toBe('baby-shower-de-maria');
  });

  it('removes special characters', () => {
    const slug = generateSlug('¡Fiesta! de cumpleaños #1');
    expect(slug).toBe('fiesta-de-cumpleanos-1');
  });

  it('returns base slug without random suffix', () => {
    const slug1 = generateSlug('Mi Evento');
    const slug2 = generateSlug('Mi Evento');
    expect(slug1).toBe(slug2);
  });
});

describe('generateUniqueSlug', () => {
  it('returns base slug when no collision', () => {
    const slug = generateUniqueSlug('mi-evento', new Set(['otro-evento']));
    expect(slug).toBe('mi-evento');
  });

  it('generates unique slug on collision', () => {
    const slug = generateUniqueSlug('mi-evento', new Set(['mi-evento']));
    expect(slug).not.toBe('mi-evento');
    expect(slug).toMatch(/^mi-evento-/);
  });

  it('handles max attempts gracefully', () => {
    const existing = new Set<string>(['test']);
    for (let i = 0; i < 50; i++) {
      existing.add(`test-${i.toString(16).padStart(4, '0')}`);
    }
    const slug = generateUniqueSlug('test', existing);
    expect(slug).toMatch(/^test-/);
    expect(existing.has(slug)).toBe(false);
  });
});

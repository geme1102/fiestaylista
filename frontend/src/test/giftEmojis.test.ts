import { describe, it, expect } from 'vitest';
import { getGiftCategory, getGiftImage } from '../data/giftEmojis';

describe('getGiftCategory', () => {
  it('returns Bebé for baby-related gifts', () => {
    expect(getGiftCategory('Pañales talla 1').label).toBe('Bebé');
    expect(getGiftCategory('Manta de bebé').label).toBe('Bebé');
  });

  it('returns Boda for wedding-related gifts', () => {
    expect(getGiftCategory('Vajilla completa').label).toBe('Boda');
  });

  it('returns Regalo as default category', () => {
    expect(getGiftCategory('Cualquier cosa').label).toBe('Regalo');
  });

  it('is case insensitive', () => {
    expect(getGiftCategory('PAÑALES').label).toBe('Bebé');
  });
});

describe('getGiftImage', () => {
  it('returns gift-baby for baby items', () => {
    expect(getGiftImage('pañales')).toContain('gift-baby');
  });

  it('returns gift-generic for unknown items', () => {
    expect(getGiftImage('algo raro')).toContain('gift-generic');
  });
});

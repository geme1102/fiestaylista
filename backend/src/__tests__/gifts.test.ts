import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createGiftSchema = z.object({
  name: z.string().min(1, 'El nombre del regalo es requerido').max(200, 'El nombre es demasiado largo'),
});

const updateGiftSchema = z.object({
  isClaimed: z.boolean().optional(),
  claimedBy: z.string().nullable().optional(),
});

describe('Gifts - Create Validation', () => {
  it('accepts valid gift name', () => {
    const result = createGiftSchema.parse({ name: 'Pañales talla 1' });
    expect(result.name).toBe('Pañales talla 1');
  });

  it('rejects empty name', () => {
    expect(() => createGiftSchema.parse({ name: '' })).toThrow();
  });

  it('rejects name exceeding 200 chars', () => {
    expect(() => createGiftSchema.parse({ name: 'x'.repeat(201) })).toThrow();
  });
});

describe('Gifts - Update Validation', () => {
  it('accepts claim update', () => {
    const result = updateGiftSchema.parse({
      isClaimed: true,
      claimedBy: 'Juan Pérez',
    });
    expect(result.isClaimed).toBe(true);
    expect(result.claimedBy).toBe('Juan Pérez');
  });

  it('accepts release update', () => {
    const result = updateGiftSchema.parse({
      isClaimed: false,
      claimedBy: null,
    });
    expect(result.isClaimed).toBe(false);
    expect(result.claimedBy).toBeNull();
  });

  it('accepts empty update', () => {
    const result = updateGiftSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

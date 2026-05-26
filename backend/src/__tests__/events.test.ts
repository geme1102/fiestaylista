import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const EVENT_TYPES = ['BABY_SHOWER', 'WEDDING', 'BIRTHDAY', 'BAPTISM', 'COMMUNION'] as const;

const createEventSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200, 'El título es demasiado largo'),
  eventType: z.enum(EVENT_TYPES, {
    errorMap: () => ({ message: 'Tipo de evento inválido' }),
  }),
  hostPhone: z.string().optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  eventType: z.enum(EVENT_TYPES).optional(),
  hostPhone: z.string().optional(),
});

describe('Events - Create Validation', () => {
  it('accepts valid event data', () => {
    const result = createEventSchema.parse({
      title: 'Baby Shower de María',
      eventType: 'BABY_SHOWER',
    });
    expect(result.title).toBe('Baby Shower de María');
    expect(result.eventType).toBe('BABY_SHOWER');
  });

  it('accepts event with host phone', () => {
    const result = createEventSchema.parse({
      title: 'Mi Boda',
      eventType: 'WEDDING',
      hostPhone: '+54 11 1234-5678',
    });
    expect(result.hostPhone).toBe('+54 11 1234-5678');
  });

  it('rejects empty title', () => {
    expect(() =>
      createEventSchema.parse({
        title: '',
        eventType: 'BIRTHDAY',
      }),
    ).toThrow();
  });

  it('rejects invalid event type', () => {
    expect(() =>
      createEventSchema.parse({
        title: 'Test',
        eventType: 'INVALID_TYPE',
      }),
    ).toThrow();
  });

  it('rejects title exceeding 200 chars', () => {
    expect(() =>
      createEventSchema.parse({
        title: 'x'.repeat(201),
        eventType: 'BABY_SHOWER',
      }),
    ).toThrow();
  });
});

describe('Events - Update Validation', () => {
  it('accepts partial update', () => {
    const result = updateEventSchema.parse({
      title: 'Nuevo Título',
    });
    expect(result.title).toBe('Nuevo Título');
  });

  it('accepts empty update object', () => {
    const result = updateEventSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

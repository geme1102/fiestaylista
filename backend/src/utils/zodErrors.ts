import type { ZodError } from 'zod';

const ERROR_MAP: Record<string, string> = {
  'Expected string, received null': 'Este campo no puede estar vacío',
  'Expected string, received undefined': 'Este campo es obligatorio',
  'Expected number, received nan': 'Debe ser un número válido',
  'Expected boolean, received null': 'Este campo no puede estar vacío',
  'Invalid email': 'Correo electrónico inválido',
  'Invalid url': 'URL inválida',
  'Required': 'Este campo es obligatorio',
  'String must contain at least 1 character(s)': 'El campo no puede estar vacío',
  'La contraseña debe tener al menos 8 caracteres': 'La contraseña debe tener al menos 8 caracteres',
  'La contraseña debe contener al menos una mayúscula': 'Debe incluir al menos una mayúscula',
  'La contraseña debe contener al menos un número': 'Debe incluir al menos un número',
};

export function formatZodError(error: ZodError): string {
  const messages = error.errors.map((e) => {
    if (e.message in ERROR_MAP) return ERROR_MAP[e.message];

    if (e.code === 'too_small' && 'minimum' in e) {
      const min = (e as any).minimum;
      if (e.type === 'string') return `Debe tener al menos ${min} caracteres`;
      if (e.type === 'number') return `Debe ser mayor o igual a ${min}`;
    }
    if (e.code === 'too_big' && 'maximum' in e) {
      const max = (e as any).maximum;
      if (e.type === 'string') return `Debe tener máximo ${max} caracteres`;
    }
    if (e.code === 'invalid_type') {
      if (e.received === 'undefined') return 'Este campo es obligatorio';
      if (e.received === 'null') return 'Este campo no puede estar vacío';
    }
    if (e.code === 'invalid_string' && 'validation' in e) {
      const validation = (e as any).validation;
      if (validation === 'email') return 'Correo electrónico inválido';
    }

    return e.message;
  });

  return messages.join('. ');
}

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../config.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-at-least-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-chars',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

vi.mock('../db/index.js', () => ({
  db: {},
  sql: {},
}));

const registerSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
});

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

describe('Auth - Register Validation', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'Password1',
      name: 'Test User',
    });
    expect(result.email).toBe('test@example.com');
  });

  it('rejects short password', () => {
    expect(() =>
      registerSchema.parse({
        email: 'test@example.com',
        password: 'Sh0rt',
        name: 'Test',
      }),
    ).toThrow();
  });

  it('rejects password without uppercase', () => {
    expect(() =>
      registerSchema.parse({
        email: 'test@example.com',
        password: 'password1',
        name: 'Test',
      }),
    ).toThrow();
  });

  it('rejects password without number', () => {
    expect(() =>
      registerSchema.parse({
        email: 'test@example.com',
        password: 'Password',
        name: 'Test',
      }),
    ).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      registerSchema.parse({
        email: 'not-an-email',
        password: 'Password1',
        name: 'Test',
      }),
    ).toThrow();
  });

  it('rejects short name', () => {
    expect(() =>
      registerSchema.parse({
        email: 'test@example.com',
        password: 'Password1',
        name: 'A',
      }),
    ).toThrow();
  });
});

describe('Auth - Login Validation', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.parse({
      email: 'test@example.com',
      password: 'somepassword',
    });
    expect(result.email).toBe('test@example.com');
  });

  it('rejects empty password', () => {
    expect(() =>
      loginSchema.parse({
        email: 'test@example.com',
        password: '',
      }),
    ).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      loginSchema.parse({
        email: 'invalid',
        password: 'password',
      }),
    ).toThrow();
  });
});

describe('D2-A4 - BCRYPT_COST', () => {
  it('usa cost 11 para hashing de contraseñas (bcryptjs corre en el event loop)', async () => {
    const { BCRYPT_COST } = await import('../services/auth.js');
    expect(BCRYPT_COST).toBe(11);
  });
});

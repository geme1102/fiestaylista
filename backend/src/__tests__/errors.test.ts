import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError } from '../utils/errors.js';

describe('AppError', () => {
  it('creates error with status code and message', () => {
    const err = new AppError(400, 'test error');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('test error');
    expect(err.name).toBe('AppError');
  });
});

describe('NotFoundError', () => {
  it('has 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });
});

describe('UnauthorizedError', () => {
  it('has 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });
});

describe('ForbiddenError', () => {
  it('has 403 status', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });
});

describe('ValidationError', () => {
  it('has 400 status', () => {
    const err = new ValidationError('campo requerido');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('campo requerido');
  });
});

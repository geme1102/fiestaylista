import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { asyncHandler, asyncHandlerWithValidation } from '../utils/asyncHandler.js';
import { z } from 'zod';

function mockReqRes() {
  const req = {} as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe('asyncHandler', () => {
  it('calls next on success', async () => {
    const { req, res, next } = mockReqRes();
    const handler = asyncHandler(async (_req, _res, _next) => {});
    await handler(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with error on rejection', async () => {
    const { req, res, next } = mockReqRes();
    const testError = new Error('test error');
    const handler = asyncHandler(async (_req, _res, _next) => {
      throw testError;
    });
    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(testError);
  });
});

describe('asyncHandlerWithValidation', () => {
  it('calls next on success', async () => {
    const { req, res, next } = mockReqRes();
    const handler = asyncHandlerWithValidation(async (_req, _res, _next) => {});
    await handler(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with error on rejection', async () => {
    const { req, res, next } = mockReqRes();
    const testError = new Error('test error');
    const handler = asyncHandlerWithValidation(async (_req, _res, _next) => {
      throw testError;
    });
    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(testError);
  });

  it('converts ZodError to ValidationError', async () => {
    const { req, res, next } = mockReqRes();
    const schema = z.object({ name: z.string().min(1) });
    const handler = asyncHandlerWithValidation(async (_req, _res, _next) => {
      schema.parse({ name: '' });
    });
    await handler(req, res, next);
    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('String must contain at least 1 character');
  });
});

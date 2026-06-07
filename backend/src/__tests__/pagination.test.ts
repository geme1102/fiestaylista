import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { buildPaginationConditions } from '../utils/pagination.js';

describe('buildPaginationConditions', () => {
  const createdAt = sql`created_at`;

  it('returns default limit when no params', () => {
    const result = buildPaginationConditions(createdAt, {});
    expect(result.limit).toBe(50);
    expect(result.cursorCondition).toBeUndefined();
  });

  it('returns custom limit within bounds', () => {
    const result = buildPaginationConditions(createdAt, { limit: 10 });
    expect(result.limit).toBe(10);
  });

  it('clamps limit to minimum of 1', () => {
    const result = buildPaginationConditions(createdAt, { limit: 0 });
    expect(result.limit).toBe(1);
  });

  it('clamps limit to maximum of 200', () => {
    const result = buildPaginationConditions(createdAt, { limit: 500 });
    expect(result.limit).toBe(200);
  });

  it('returns cursor condition when cursor provided', () => {
    const result = buildPaginationConditions(createdAt, { cursor: '2024-01-01T00:00:00Z' });
    expect(result.limit).toBe(50);
    expect(result.cursorCondition).toBeDefined();
  });

  it('returns cursor condition with limit override', () => {
    const result = buildPaginationConditions(createdAt, { limit: 25, cursor: 'abc123' });
    expect(result.limit).toBe(25);
    expect(result.cursorCondition).toBeDefined();
  });
});

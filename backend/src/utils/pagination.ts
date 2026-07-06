import { sql, type SQL } from 'drizzle-orm';

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

export function buildPaginationConditions(
  cursorField: SQL,
  params: PaginationParams,
  defaultLimit = 50,
): { limit: number; cursorCondition: SQL | undefined } {
  const limit = isNaN(params.limit as number) ? defaultLimit : Math.min(Math.max(1, params.limit ?? defaultLimit), 200);
  const cursorCondition = params.cursor
    ? sql`${cursorField} < ${params.cursor}`
    : undefined;
  return { limit, cursorCondition };
}

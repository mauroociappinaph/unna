import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, Page, PageRequest } from '@unna/domain';

/** Response header with the cursor of the next page; absent on the last page (S17). */
export const NEXT_CURSOR_HEADER = 'X-Next-Cursor';

/** `limit` and `cursor` of a paginated list; list query DTOs extend it. */
export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_LIMIT) limit?: number;
  /** Id of the last item the client received. */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) cursor?: string;
}

export const pageRequest = (query: PageQuery): PageRequest => ({ limit: query.limit ?? DEFAULT_PAGE_LIMIT, cursor: query.cursor });

/** The body stays the array of items; the next cursor travels in X-Next-Cursor. */
export async function sendPage<T>(res: Response, pending: Promise<Page<T>>): Promise<T[]> {
  const page = await pending;
  if (page.nextCursor) res.setHeader(NEXT_CURSOR_HEADER, page.nextCursor);
  return page.items;
}

import type { AxiosResponse } from 'axios';
import type { Page } from '../api-types';

/** Reads a paginated list: the body is the page and X-Next-Cursor (lowercased by axios) the cursor of the next one (S17). */
export function toPage<T>(response: Pick<AxiosResponse<T[]>, 'data' | 'headers'>): Page<T> {
  const next = response.headers?.['x-next-cursor'];
  return { items: response.data, nextCursor: typeof next === 'string' && next ? next : null };
}

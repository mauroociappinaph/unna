import { Page } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

/**
 * Repositories answer null when the cursor is not an item of the business (unknown or of another
 * business): a client error (400) that returns no data (S17).
 */
export const pageOrInvalidCursor = <T>(page: Page<T> | null): UseCaseResult<Page<T>> =>
  page ? { ok: true, value: page } : { ok: false, error: new Error('Cursor inválido') };

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, toPage } from '../pagination';

describe('pagination (S17)', () => {
  it('defaults to 50 items per page, at most 200', () => {
    expect(DEFAULT_PAGE_LIMIT).toBe(50);
    expect(MAX_PAGE_LIMIT).toBe(200);
  });

  it('keeps `limit` rows and points the next cursor at the last one when a row is left over', () => {
    expect(toPage([{ id: 'c' }, { id: 'b' }, { id: 'a' }], 2)).toEqual({ items: [{ id: 'c' }, { id: 'b' }], nextCursor: 'b' });
  });

  it('has no next cursor when every row fits', () => {
    expect(toPage([{ id: 'b' }, { id: 'a' }], 2)).toEqual({ items: [{ id: 'b' }, { id: 'a' }] });
    expect(toPage([], 2)).toEqual({ items: [] });
  });
});

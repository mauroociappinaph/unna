/** A recorded API reply as stored in api-shapes.json. */
export interface ShapedReply {
  status: number;
  body: unknown;
}

export function jsonResponse({ status, body }: ShapedReply): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** Replaces the global fetch with a jest mock; jsdom does not ship one. */
export function mockFetch(): jest.Mock {
  const mock = jest.fn();
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

/** Calls whose URL contains the fragment and whose method matches (GET when omitted). */
export function fetchCalls(mock: jest.Mock, fragment: string, method = 'GET'): [string, RequestInit | undefined][] {
  return (mock.mock.calls as [string, RequestInit | undefined][]).filter(
    ([url, init]) => url.includes(fragment) && (init?.method ?? 'GET') === method,
  );
}

export function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

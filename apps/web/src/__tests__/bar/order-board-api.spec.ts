import { ApiRequestError, getBarQueue } from '@/lib/order-board-api';
import { refreshAccessToken } from '@/lib/api';
import shapes from '../fixtures/api-shapes.json';
import { headerOf, jsonResponse, mockFetch } from './fetch-mock';

jest.mock('@/lib/api', () => ({ api: {}, refreshAccessToken: jest.fn() }));

const refresh = refreshAccessToken as jest.Mock;
const queue = shapes['GET bar-queue (new)'];
const expired = { status: 401, body: { statusCode: 401, message: 'Unauthorized' } };

describe('owner requests of the bar (long-running screen)', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'old-token');
    refresh.mockReset();
    fetchMock = mockFetch();
  });

  it('renews an expired session once and retries with the new token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(expired)).mockResolvedValueOnce(jsonResponse(queue));
    refresh.mockResolvedValue('new-token');

    const result = await getBarQueue('biz-1', 'suc-1');

    expect(result).toEqual(queue.body);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(headerOf(fetchMock.mock.calls[0][1], 'Authorization')).toBe('Bearer old-token');
    expect(headerOf(fetchMock.mock.calls[1][1], 'Authorization')).toBe('Bearer new-token');
  });

  it('gives up with the 401 when the session cannot be renewed', async () => {
    fetchMock.mockResolvedValue(jsonResponse(expired));
    refresh.mockResolvedValue(null);

    await expect(getBarQueue('biz-1', 'suc-1')).rejects.toBeInstanceOf(ApiRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on other errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 403, body: { message: 'Forbidden' } }));

    await expect(getBarQueue('biz-1', 'suc-1')).rejects.toMatchObject({ response: { status: 403 } });
    expect(refresh).not.toHaveBeenCalled();
  });
});

import axios from 'axios';
import { refreshAccessToken } from '@/lib/api';

jest.mock('axios', () => {
  const instance = { interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
  return { __esModule: true, default: { create: jest.fn(() => instance), post: jest.fn() } };
});

const post = axios.post as jest.Mock;

describe('refreshAccessToken', () => {
  beforeEach(() => {
    localStorage.clear();
    post.mockReset();
  });

  it('without a refresh token returns null and keeps the current session untouched (e.g. a wrong password on /login)', async () => {
    localStorage.setItem('auth_token', 'current');

    await expect(refreshAccessToken()).resolves.toBeNull();

    expect(post).not.toHaveBeenCalled();
    expect(localStorage.getItem('auth_token')).toBe('current');
  });

  it('stores and returns the renewed tokens', async () => {
    localStorage.setItem('refresh_token', 'refresh-1');
    post.mockResolvedValue({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

    await expect(refreshAccessToken()).resolves.toBe('access-2');

    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/auth\/refresh$/), { refreshToken: 'refresh-1' });
    expect(localStorage.getItem('auth_token')).toBe('access-2');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
  });

  it('shares one renewal between concurrent callers, so a rotated refresh token is not spent twice', async () => {
    localStorage.setItem('refresh_token', 'refresh-1');
    let resolve!: (value: unknown) => void;
    post.mockReturnValue(new Promise((r) => { resolve = r; }));

    const first = refreshAccessToken();
    const second = refreshAccessToken();
    resolve({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

    await expect(Promise.all([first, second])).resolves.toEqual(['access-2', 'access-2']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
  });

  it('starts a new renewal once the previous one finished', async () => {
    localStorage.setItem('refresh_token', 'refresh-1');
    post.mockResolvedValueOnce({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });
    post.mockResolvedValueOnce({ data: { accessToken: 'access-3', refreshToken: 'refresh-3' } });

    await refreshAccessToken();
    await expect(refreshAccessToken()).resolves.toBe('access-3');

    expect(post).toHaveBeenLastCalledWith(expect.any(String), { refreshToken: 'refresh-2' });
  });

  it('clears the session when the renewal fails', async () => {
    localStorage.setItem('auth_token', 'expired');
    localStorage.setItem('refresh_token', 'refresh-1');
    post.mockRejectedValue(new Error('401'));

    await expect(refreshAccessToken()).resolves.toBeNull();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });
});

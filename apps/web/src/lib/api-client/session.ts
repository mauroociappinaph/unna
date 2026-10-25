import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// A hung renewal would hold the shared promise forever and block every later renewal.
const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Renews the session with the stored refresh token and returns the new access token. Without a
 * refresh token it returns null and leaves the page alone (e.g. a wrong password on /login); when
 * the renewal itself fails it clears the session and sends the user to /login. Concurrent callers
 * (the bar polling while the POS saves) share one renewal, so a rotated refresh token is spent once.
 */
let pendingRefresh: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  pendingRefresh ??= renewSession().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

async function renewSession(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken }, { timeout: REFRESH_TIMEOUT_MS });
    const { accessToken, refreshToken: newRefreshToken } = response.data;
    localStorage.setItem('auth_token', accessToken);
    localStorage.setItem('refresh_token', newRefreshToken);
    return accessToken;
  } catch {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
    return null;
  }
}

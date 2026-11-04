import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_URL, refreshAccessToken } from './session';

/** Axios instance for the API: sends the stored token and retries a 401 once with a renewed session. */
export function createHttpClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const accessToken = await refreshAccessToken();
        if (accessToken) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return client(originalRequest);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

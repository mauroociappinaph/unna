import type { AxiosInstance } from 'axios';

export function createAuthApi(client: AxiosInstance) {
  return {
    async register(data: {
      businessName: string;
      name: string;
      phone: string;
      email: string;
      password: string;
      confirmPassword: string;
      acceptTerms: boolean;
    }) {
      const response = await client.post('/auth/register', data);
      return response.data;
    },

    async login(email: string, password: string) {
      const response = await client.post('/auth/login', { email, password });
      return response.data;
    },

    async refresh(refreshToken: string) {
      const response = await client.post('/auth/refresh', { refreshToken });
      return response.data;
    },

    async forgotPassword(data: { email: string }): Promise<{ message: string }> {
      const response = await client.post('/auth/forgot-password', data);
      return response.data;
    },

    async resetPassword(data: { token: string; password: string; confirmPassword: string }): Promise<{ message: string }> {
      const response = await client.post('/auth/reset-password', data);
      return response.data;
    },
  };
}

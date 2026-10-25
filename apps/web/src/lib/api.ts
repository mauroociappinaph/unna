import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use(
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

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
                refreshToken,
              });

              const { accessToken, refreshToken: newRefreshToken } = response.data;
              localStorage.setItem('auth_token', accessToken);
              localStorage.setItem('refresh_token', newRefreshToken);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client(originalRequest);
            }
          } catch {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async register(data: {
    businessName: string;
    name: string;
    phone: string;
    email: string;
    password: string;
    confirmPassword: string;
    acceptTerms: boolean;
  }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async refresh(refreshToken: string) {
    const response = await this.client.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async getBusinesses() {
    const response = await this.client.get('/businesses');
    return response.data;
  }

  async createBusiness(data: { businessName: string }) {
    const response = await this.client.post('/businesses', data);
    return response.data;
  }

  // --- Business Settings ---
  async updateBusinessSettings(businessId: string, settings: {
    tradeName?: string;
    legalName?: string;
    ivaCondition?: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';
    iibbNumber?: string;
    salePoint?: string;
    currency?: 'ARS' | 'USD';
    timezone?: string;
    language?: string;
    logoUrl?: string;
  }) {
    const response = await this.client.patch(`/businesses/${businessId}/settings`, settings);
    return response.data;
  }

  async updateBusinessAddress(businessId: string, address: {
    street: string;
    number: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  }) {
    const response = await this.client.patch(`/businesses/${businessId}/address`, address);
    return response.data;
  }

  async updateBusinessSchedule(businessId: string, schedule: {
    monday: { open: string; close: string; isClosed: boolean };
    tuesday: { open: string; close: string; isClosed: boolean };
    wednesday: { open: string; close: string; isClosed: boolean };
    thursday: { open: string; close: string; isClosed: boolean };
    friday: { open: string; close: string; isClosed: boolean };
    saturday: { open: string; close: string; isClosed: boolean };
    sunday: { open: string; close: string; isClosed: boolean };
  }) {
    const response = await this.client.patch(`/businesses/${businessId}/schedule`, schedule);
    return response.data;
  }

  // --- Sucursal Management ---
  async createSucursal(businessId: string, sucursal: {
    name: string;
    address: {
      street: string;
      number: string;
      floor?: string;
      apartment?: string;
      neighborhood?: string;
      city: string;
      province: string;
      postalCode: string;
      country: string;
    };
    phone: string;
    email: string;
    schedule?: {
      monday: { open: string; close: string; isClosed: boolean };
      tuesday: { open: string; close: string; isClosed: boolean };
      wednesday: { open: string; close: string; isClosed: boolean };
      thursday: { open: string; close: string; isClosed: boolean };
      friday: { open: string; close: string; isClosed: boolean };
      saturday: { open: string; close: string; isClosed: boolean };
      sunday: { open: string; close: string; isClosed: boolean };
    };
    isMain?: boolean;
    isActive?: boolean;
  }) {
    const response = await this.client.post(`/businesses/${businessId}/sucursales`, {
      action: 'create',
      sucursal,
    });
    return response.data;
  }

  async updateSucursal(businessId: string, sucursalId: string, sucursal: {
    name: string;
    address: {
      street: string;
      number: string;
      floor?: string;
      apartment?: string;
      neighborhood?: string;
      city: string;
      province: string;
      postalCode: string;
      country: string;
    };
    phone: string;
    email: string;
    schedule?: {
      monday: { open: string; close: string; isClosed: boolean };
      tuesday: { open: string; close: string; isClosed: boolean };
      wednesday: { open: string; close: string; isClosed: boolean };
      thursday: { open: string; close: string; isClosed: boolean };
      friday: { open: string; close: string; isClosed: boolean };
      saturday: { open: string; close: string; isClosed: boolean };
      sunday: { open: string; close: string; isClosed: boolean };
    };
    isMain?: boolean;
    isActive?: boolean;
  }) {
    const response = await this.client.put(`/businesses/${businessId}/sucursales/${sucursalId}`, {
      action: 'update',
      sucursal: { ...sucursal, id: sucursalId },
    });
    return response.data;
  }

  async deleteSucursal(businessId: string, sucursalId: string) {
    const response = await this.client.delete(`/businesses/${businessId}/sucursales/${sucursalId}`);
    return response.data;
  }

  // --- Schedule Management ---
  async updateSucursalSchedule(businessId: string, sucursalId: string, schedule: {
    monday: { open: string; close: string; isClosed: boolean };
    tuesday: { open: string; close: string; isClosed: boolean };
    wednesday: { open: string; close: string; isClosed: boolean };
    thursday: { open: string; close: string; isClosed: boolean };
    friday: { open: string; close: string; isClosed: boolean };
    saturday: { open: string; close: string; isClosed: boolean };
    sunday: { open: string; close: string; isClosed: boolean };
  }) {
    const response = await this.client.patch(`/businesses/${businessId}/schedule`, {
      sucursalId,
      schedule,
    });
    return response.data;
  }
}

export const api = new ApiClient();
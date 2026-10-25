import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  CashMovementInput, CashSession, Category, CategoryInput, CloseCashSessionInput, CreateOrderInput, IssueReceiptInput,
  ModifierGroup, ModifierGroupInput, ModifierOptionInput, Order, OrderAction, OrderLineInput, Payment, PaymentMethod,
  PaymentResult, Product, ProductInput, ProductStatus, Receipt, StockChange, StockLevel, StockMovement, StockOutType,
} from './api-types';

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
  // --- Catalog ---
  async listCategories(businessId: string): Promise<Category[]> {
    return (await this.client.get(`/businesses/${businessId}/categories`)).data;
  }

  async createCategory(businessId: string, data: CategoryInput): Promise<Category> {
    return (await this.client.post(`/businesses/${businessId}/categories`, data)).data;
  }

  async updateCategory(businessId: string, categoryId: string, data: Partial<CategoryInput>): Promise<Category> {
    return (await this.client.put(`/businesses/${businessId}/categories/${categoryId}`, data)).data;
  }

  async deleteCategory(businessId: string, categoryId: string): Promise<void> {
    await this.client.delete(`/businesses/${businessId}/categories/${categoryId}`);
  }

  async listProducts(businessId: string, filters: { categoryId?: string; status?: ProductStatus; activeOnly?: boolean } = {}): Promise<Product[]> {
    return (await this.client.get(`/businesses/${businessId}/products`, { params: filters })).data;
  }

  async createProduct(businessId: string, data: ProductInput): Promise<Product> {
    return (await this.client.post(`/businesses/${businessId}/products`, data)).data;
  }

  async updateProduct(businessId: string, productId: string, data: Partial<ProductInput>): Promise<Product> {
    return (await this.client.put(`/businesses/${businessId}/products/${productId}`, data)).data;
  }

  async deleteProduct(businessId: string, productId: string): Promise<void> {
    await this.client.delete(`/businesses/${businessId}/products/${productId}`);
  }

  async listModifierGroups(businessId: string): Promise<ModifierGroup[]> {
    return (await this.client.get(`/businesses/${businessId}/modifier-groups`)).data;
  }

  async createModifierGroup(businessId: string, data: ModifierGroupInput): Promise<ModifierGroup> {
    return (await this.client.post(`/businesses/${businessId}/modifier-groups`, data)).data;
  }

  async updateModifierGroup(businessId: string, groupId: string, data: Omit<Partial<ModifierGroupInput>, 'options' | 'displayOrder'>): Promise<ModifierGroup> {
    return (await this.client.put(`/businesses/${businessId}/modifier-groups/${groupId}`, data)).data;
  }

  async addModifierOption(businessId: string, groupId: string, data: ModifierOptionInput): Promise<ModifierGroup> {
    return (await this.client.post(`/businesses/${businessId}/modifier-groups/${groupId}/options`, data)).data;
  }

  async removeModifierOption(businessId: string, groupId: string, optionId: string): Promise<void> {
    await this.client.delete(`/businesses/${businessId}/modifier-groups/${groupId}/options/${optionId}`);
  }

  async deleteModifierGroup(businessId: string, groupId: string): Promise<void> {
    await this.client.delete(`/businesses/${businessId}/modifier-groups/${groupId}`);
  }

  async listStockLevels(businessId: string): Promise<StockLevel[]> {
    return (await this.client.get(`/businesses/${businessId}/stock/levels`)).data;
  }

  async listStockMovements(businessId: string, productId?: string): Promise<StockMovement[]> {
    return (await this.client.get(`/businesses/${businessId}/stock/movements`, { params: productId ? { productId } : {} })).data;
  }

  async initializeStock(businessId: string, productId: string, data: { initialQuantity: number; minThreshold?: number }): Promise<StockLevel> {
    return (await this.client.post(`/businesses/${businessId}/stock/initialize/${productId}`, data)).data;
  }

  async addStock(businessId: string, productId: string, data: { quantity: number; reason: string }): Promise<StockChange> {
    return (await this.client.post(`/businesses/${businessId}/stock/in/${productId}`, data)).data;
  }

  async removeStock(businessId: string, productId: string, data: { quantity: number; reason: string; type?: StockOutType }): Promise<StockChange> {
    return (await this.client.post(`/businesses/${businessId}/stock/out/${productId}`, data)).data;
  }

  // --- Sales / POS ---
  async createOrder(businessId: string, data: CreateOrderInput): Promise<Order> {
    return (await this.client.post(`/businesses/${businessId}/orders`, data)).data;
  }

  async listOrders(businessId: string, filters: { status?: string; sucursalId?: string } = {}): Promise<Order[]> {
    return (await this.client.get(`/businesses/${businessId}/orders`, { params: filters })).data;
  }

  async getOrder(businessId: string, orderId: string): Promise<Order> {
    return (await this.client.get(`/businesses/${businessId}/orders/${orderId}`)).data;
  }

  async addOrderItem(businessId: string, orderId: string, line: OrderLineInput): Promise<Order> {
    return (await this.client.post(`/businesses/${businessId}/orders/${orderId}/items`, line)).data;
  }

  async removeOrderItem(businessId: string, orderId: string, itemId: string): Promise<Order> {
    return (await this.client.delete(`/businesses/${businessId}/orders/${orderId}/items/${itemId}`)).data;
  }

  async applyOrderDiscount(businessId: string, orderId: string, amount: number): Promise<Order> {
    return (await this.client.post(`/businesses/${businessId}/orders/${orderId}/discount`, { amount })).data;
  }

  async changeOrderStatus(businessId: string, orderId: string, action: OrderAction, reason?: string): Promise<Order> {
    return (await this.client.post(`/businesses/${businessId}/orders/${orderId}/status`, { action, reason })).data;
  }

  async registerPayment(businessId: string, orderId: string, data: { amount: number; method: PaymentMethod; reference?: string }): Promise<PaymentResult> {
    return (await this.client.post(`/businesses/${businessId}/orders/${orderId}/payments`, data)).data;
  }

  async listPayments(businessId: string, orderId: string): Promise<Payment[]> {
    return (await this.client.get(`/businesses/${businessId}/orders/${orderId}/payments`)).data;
  }

  async issueReceipt(businessId: string, orderId: string, data: IssueReceiptInput): Promise<Receipt> {
    return (await this.client.post(`/businesses/${businessId}/orders/${orderId}/receipts`, data)).data;
  }

  // --- Caja ---
  async openCashSession(businessId: string, data: { sucursalId: string; openingAmount: number }): Promise<CashSession> {
    return (await this.client.post(`/businesses/${businessId}/cash-sessions`, data)).data;
  }

  /** The open session of the sucursal, or null when its caja is closed. */
  async getCurrentCashSession(businessId: string, sucursalId: string): Promise<CashSession | null> {
    const { session } = (await this.client.get(`/businesses/${businessId}/cash-sessions/current`, { params: { sucursalId } })).data;
    return session ?? null;
  }

  async listCashSessions(businessId: string, filters: { sucursalId?: string; status?: 'open' | 'closed'; from?: string; to?: string } = {}): Promise<CashSession[]> {
    return (await this.client.get(`/businesses/${businessId}/cash-sessions`, { params: filters })).data;
  }

  async getCashSession(businessId: string, sessionId: string): Promise<CashSession> {
    return (await this.client.get(`/businesses/${businessId}/cash-sessions/${sessionId}`)).data;
  }

  async addCashMovement(businessId: string, sessionId: string, data: CashMovementInput): Promise<CashSession> {
    return (await this.client.post(`/businesses/${businessId}/cash-sessions/${sessionId}/movements`, data)).data;
  }

  async closeCashSession(businessId: string, sessionId: string, data: CloseCashSessionInput): Promise<CashSession> {
    return (await this.client.post(`/businesses/${businessId}/cash-sessions/${sessionId}/close`, data)).data;
  }
}


export const api = new ApiClient();
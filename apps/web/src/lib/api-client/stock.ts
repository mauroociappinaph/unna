import type { AxiosInstance } from 'axios';
import type { Page, PageQuery, StockChange, StockLevel, StockMovement, StockOutType } from '../api-types';
import { toPage } from './page';

export function createStockApi(client: AxiosInstance) {
  return {
    async listStockLevels(businessId: string): Promise<StockLevel[]> {
      return (await client.get(`/businesses/${businessId}/stock/levels`)).data;
    },

    async listStockMovements(businessId: string, filters: { productId?: string } & PageQuery = {}): Promise<Page<StockMovement>> {
      return toPage(await client.get(`/businesses/${businessId}/stock/movements`, { params: filters }));
    },

    async initializeStock(businessId: string, productId: string, data: { initialQuantity: number; minThreshold?: number }): Promise<StockLevel> {
      return (await client.post(`/businesses/${businessId}/stock/initialize/${productId}`, data)).data;
    },

    async addStock(businessId: string, productId: string, data: { quantity: number; reason: string }): Promise<StockChange> {
      return (await client.post(`/businesses/${businessId}/stock/in/${productId}`, data)).data;
    },

    async removeStock(businessId: string, productId: string, data: { quantity: number; reason: string; type?: StockOutType }): Promise<StockChange> {
      return (await client.post(`/businesses/${businessId}/stock/out/${productId}`, data)).data;
    },
  };
}

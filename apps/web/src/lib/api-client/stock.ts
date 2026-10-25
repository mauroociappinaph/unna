import type { AxiosInstance } from 'axios';
import type { StockChange, StockLevel, StockMovement, StockOutType } from '../api-types';

export function createStockApi(client: AxiosInstance) {
  return {
    async listStockLevels(businessId: string): Promise<StockLevel[]> {
      return (await client.get(`/businesses/${businessId}/stock/levels`)).data;
    },

    async listStockMovements(businessId: string, productId?: string): Promise<StockMovement[]> {
      return (await client.get(`/businesses/${businessId}/stock/movements`, { params: productId ? { productId } : {} })).data;
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

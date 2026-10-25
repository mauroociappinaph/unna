import type { AxiosInstance } from 'axios';
import type {
  CreateOrderInput, IssueReceiptInput, Order, OrderAction, OrderLineInput, Payment, PaymentMethod, PaymentResult, Receipt,
} from '../api-types';

export function createSalesApi(client: AxiosInstance) {
  return {
    async createOrder(businessId: string, data: CreateOrderInput): Promise<Order> {
      return (await client.post(`/businesses/${businessId}/orders`, data)).data;
    },

    async listOrders(businessId: string, filters: { status?: string; sucursalId?: string } = {}): Promise<Order[]> {
      return (await client.get(`/businesses/${businessId}/orders`, { params: filters })).data;
    },

    async getOrder(businessId: string, orderId: string): Promise<Order> {
      return (await client.get(`/businesses/${businessId}/orders/${orderId}`)).data;
    },

    async addOrderItem(businessId: string, orderId: string, line: OrderLineInput): Promise<Order> {
      return (await client.post(`/businesses/${businessId}/orders/${orderId}/items`, line)).data;
    },

    async removeOrderItem(businessId: string, orderId: string, itemId: string): Promise<Order> {
      return (await client.delete(`/businesses/${businessId}/orders/${orderId}/items/${itemId}`)).data;
    },

    async applyOrderDiscount(businessId: string, orderId: string, amount: number): Promise<Order> {
      return (await client.post(`/businesses/${businessId}/orders/${orderId}/discount`, { amount })).data;
    },

    async changeOrderStatus(businessId: string, orderId: string, action: OrderAction, reason?: string): Promise<Order> {
      return (await client.post(`/businesses/${businessId}/orders/${orderId}/status`, { action, reason })).data;
    },

    async registerPayment(businessId: string, orderId: string, data: { amount: number; method: PaymentMethod; reference?: string }): Promise<PaymentResult> {
      return (await client.post(`/businesses/${businessId}/orders/${orderId}/payments`, data)).data;
    },

    async listPayments(businessId: string, orderId: string): Promise<Payment[]> {
      return (await client.get(`/businesses/${businessId}/orders/${orderId}/payments`)).data;
    },

    async issueReceipt(businessId: string, orderId: string, data: IssueReceiptInput): Promise<Receipt> {
      return (await client.post(`/businesses/${businessId}/orders/${orderId}/receipts`, data)).data;
    },
  };
}

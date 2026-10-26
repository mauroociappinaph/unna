import type { AxiosInstance } from 'axios';
import type { MercadoPagoPos, MercadoPagoStatus, QrCharge } from '../api-types';

/** Mercado Pago account of the business (OAuth), cash register per sucursal and QR charges of the POS (S15). */
export function createMercadoPagoApi(client: AxiosInstance) {
  return {
    async getMercadoPagoStatus(businessId: string): Promise<MercadoPagoStatus> {
      return (await client.get(`/businesses/${businessId}/mercadopago`)).data;
    },

    /** Starts the OAuth flow; the browser must navigate to the returned URL. */
    async connectMercadoPago(businessId: string): Promise<{ authorizationUrl: string }> {
      return (await client.post(`/businesses/${businessId}/mercadopago/connect`)).data;
    },

    async disconnectMercadoPago(businessId: string): Promise<void> {
      await client.delete(`/businesses/${businessId}/mercadopago`);
    },

    /** Creates the store and cash register of the sucursal if missing (idempotent). */
    async provisionMercadoPagoPos(businessId: string, sucursalId: string): Promise<MercadoPagoPos> {
      return (await client.post(`/businesses/${businessId}/sucursales/${sucursalId}/mercadopago/pos`)).data;
    },

    /** Charges the pending balance; returns the pending charge if one already exists. */
    async createQrCharge(businessId: string, orderId: string): Promise<QrCharge> {
      return (await client.post(`/businesses/${businessId}/orders/${orderId}/qr-charge`)).data;
    },

    async getQrCharge(businessId: string, chargeId: string): Promise<QrCharge> {
      return (await client.get(`/businesses/${businessId}/qr-charges/${chargeId}`)).data;
    },

    async cancelQrCharge(businessId: string, chargeId: string): Promise<QrCharge> {
      return (await client.delete(`/businesses/${businessId}/qr-charges/${chargeId}`)).data;
    },
  };
}

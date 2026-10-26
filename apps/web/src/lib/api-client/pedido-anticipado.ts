import type { AxiosInstance } from 'axios';
import type { EnabledPedidoAnticipado, PedidoAnticipadoStatus } from '../api-types';

/** Pedido anticipado per sucursal (S20): public link and its QR. */
export function createPedidoAnticipadoApi(client: AxiosInstance) {
  return {
    async getPedidoAnticipado(businessId: string): Promise<PedidoAnticipadoStatus> {
      return (await client.get(`/businesses/${businessId}/pedido-anticipado`)).data;
    },

    /** Idempotent: returns the same link when it was already enabled. */
    async enablePedidoAnticipado(businessId: string, sucursalId: string): Promise<EnabledPedidoAnticipado> {
      return (await client.post(`/businesses/${businessId}/sucursales/${sucursalId}/pedido-anticipado`)).data;
    },

    /** The public link stops working until it is enabled again. */
    async disablePedidoAnticipado(businessId: string, sucursalId: string): Promise<void> {
      await client.delete(`/businesses/${businessId}/sucursales/${sucursalId}/pedido-anticipado`);
    },
  };
}

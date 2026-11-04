import type { AxiosInstance } from 'axios';
import type { CashMovementInput, CashSession, CashSessionListItem, CloseCashSessionInput, Page, PageQuery } from '../api-types';
import { toPage } from './page';

export interface CashSessionFilters extends PageQuery {
  sucursalId?: string;
  status?: 'open' | 'closed';
  from?: string;
  to?: string;
}

export function createCashApi(client: AxiosInstance) {
  return {
    async openCashSession(businessId: string, data: { sucursalId: string; openingAmount: number }): Promise<CashSession> {
      return (await client.post(`/businesses/${businessId}/cash-sessions`, data)).data;
    },

    /** The open session of the sucursal, or null when its caja is closed. */
    async getCurrentCashSession(businessId: string, sucursalId: string): Promise<CashSession | null> {
      const { session } = (await client.get(`/businesses/${businessId}/cash-sessions/current`, { params: { sucursalId } })).data;
      return session ?? null;
    },

    async listCashSessions(businessId: string, filters: CashSessionFilters = {}): Promise<Page<CashSessionListItem>> {
      return toPage(await client.get(`/businesses/${businessId}/cash-sessions`, { params: filters }));
    },

    async getCashSession(businessId: string, sessionId: string): Promise<CashSession> {
      return (await client.get(`/businesses/${businessId}/cash-sessions/${sessionId}`)).data;
    },

    async addCashMovement(businessId: string, sessionId: string, data: CashMovementInput): Promise<CashSession> {
      return (await client.post(`/businesses/${businessId}/cash-sessions/${sessionId}/movements`, data)).data;
    },

    async closeCashSession(businessId: string, sessionId: string, data: CloseCashSessionInput): Promise<CashSession> {
      return (await client.post(`/businesses/${businessId}/cash-sessions/${sessionId}/close`, data)).data;
    },
  };
}

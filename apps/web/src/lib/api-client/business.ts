import type { AxiosInstance } from 'axios';

interface DaySchedule {
  open: string;
  close: string;
  isClosed: boolean;
}

interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface AddressInput {
  street: string;
  number: string;
  floor?: string;
  apartment?: string;
  neighborhood?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

interface SucursalInput {
  name: string;
  address: AddressInput;
  phone: string;
  email: string;
  schedule?: WeekSchedule;
  isMain?: boolean;
  isActive?: boolean;
}

export function createBusinessApi(client: AxiosInstance) {
  return {
    async getBusinesses() {
      const response = await client.get('/businesses');
      return response.data;
    },

    async createBusiness(data: { businessName: string }) {
      const response = await client.post('/businesses', data);
      return response.data;
    },

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
      const response = await client.patch(`/businesses/${businessId}/settings`, settings);
      return response.data;
    },

    async updateBusinessAddress(businessId: string, address: AddressInput) {
      const response = await client.patch(`/businesses/${businessId}/address`, address);
      return response.data;
    },

    async updateBusinessSchedule(businessId: string, schedule: WeekSchedule) {
      const response = await client.patch(`/businesses/${businessId}/schedule`, schedule);
      return response.data;
    },

    // --- Sucursal Management ---
    async createSucursal(businessId: string, sucursal: SucursalInput) {
      const response = await client.post(`/businesses/${businessId}/sucursales`, {
        action: 'create',
        sucursal,
      });
      return response.data;
    },

    async updateSucursal(businessId: string, sucursalId: string, sucursal: SucursalInput) {
      const response = await client.put(`/businesses/${businessId}/sucursales/${sucursalId}`, {
        action: 'update',
        sucursal: { ...sucursal, id: sucursalId },
      });
      return response.data;
    },

    async deleteSucursal(businessId: string, sucursalId: string) {
      const response = await client.delete(`/businesses/${businessId}/sucursales/${sucursalId}`);
      return response.data;
    },

    // --- Schedule Management ---
    async updateSucursalSchedule(businessId: string, sucursalId: string, schedule: WeekSchedule) {
      const response = await client.patch(`/businesses/${businessId}/schedule`, {
        sucursalId,
        schedule,
      });
      return response.data;
    },
  };
}

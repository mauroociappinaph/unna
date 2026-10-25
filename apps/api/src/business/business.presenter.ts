import { Address, Business, BusinessSettings, Sucursal, WeekSchedule } from '@unna/domain';

export type SettingsView = Pick<BusinessSettings, 'tradeName' | 'legalName' | 'ivaCondition' | 'iibbNumber' | 'salePoint' | 'currency' | 'timezone' | 'language' | 'logoUrl'>;

export interface AddressView {
  street: string;
  number: string;
  floor?: string;
  apartment?: string;
  neighborhood?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  formatted: string;
}

export interface SucursalView {
  id: string;
  name: string;
  address: AddressView;
  phone: string;
  email: string;
  schedule: WeekSchedule;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessView {
  id: string;
  businessName: string;
  cuit: string;
  address: AddressView;
  schedule: WeekSchedule;
  settings: SettingsView;
  slug: string;
  isActive: boolean;
  sucursales: SucursalView[];
  createdAt: string;
  updatedAt: string;
}

const toAddressView = (address: Address): AddressView => ({
  street: address.street,
  number: address.number,
  floor: address.floor,
  apartment: address.apartment,
  neighborhood: address.neighborhood,
  city: address.city,
  province: address.province,
  postalCode: address.postalCode,
  country: address.country,
  formatted: address.formatted,
});

const toSucursalView = (sucursal: Sucursal): SucursalView => ({
  id: sucursal.id,
  name: sucursal.name,
  address: toAddressView(sucursal.address),
  phone: sucursal.phone,
  email: sucursal.email,
  schedule: sucursal.schedule.toJSON(),
  isMain: sucursal.isMain,
  isActive: sucursal.isActive,
  createdAt: sucursal.createdAt.toISOString(),
  updatedAt: sucursal.updatedAt.toISOString(),
});

/** HTTP view of a business: plain JSON instead of the aggregate's internal props. */
export function toBusinessView(business: Business): BusinessView {
  const s = business.settings;
  return {
    id: business.id,
    businessName: business.name.value,
    cuit: business.cuit.value,
    address: toAddressView(business.address),
    schedule: business.schedule.toJSON(),
    settings: {
      tradeName: s.tradeName,
      legalName: s.legalName,
      ivaCondition: s.ivaCondition,
      iibbNumber: s.iibbNumber,
      salePoint: s.salePoint,
      currency: s.currency,
      timezone: s.timezone,
      language: s.language,
      logoUrl: s.logoUrl,
    },
    slug: business.slug,
    isActive: business.isActive,
    sucursales: business.sucursales.map(toSucursalView),
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

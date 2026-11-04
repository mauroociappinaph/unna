// Pedido anticipado settings per sucursal (S20): a public slug that is kept when disabled, so
// enabling again gives the same link.
import type { Schedule } from '../value-objects/schedule';

export interface PreorderSucursal {
  id: string;
  businessId: string;
  name: string;
  /** The sucursal itself is active. */
  isActive: boolean;
  enabled: boolean;
  slug: string | null;
}

/** A sucursal reached by its public link, with what deciding whether it takes orders needs. */
export interface PreorderLocal extends PreorderSucursal {
  businessName: string;
  businessActive: boolean;
  schedule: Schedule;
}

export interface PreorderRepositoryPort {
  listSucursales(businessId: string): Promise<PreorderSucursal[]>;
  /** Null when the sucursal does not exist or belongs to another business. */
  findSucursal(businessId: string, sucursalId: string): Promise<PreorderSucursal | null>;
  /** The sucursal with this slug and pedido anticipado enabled; null otherwise. */
  findEnabledBySlug(slug: string): Promise<PreorderLocal | null>;
  /**
   * Enables pedido anticipado. `candidateSlug` is stored only when the sucursal has no slug yet (in
   * one conditional write, so concurrent enables keep one slug). Returns the stored slug.
   */
  enable(businessId: string, sucursalId: string, candidateSlug: string): Promise<string | null>;
  disable(businessId: string, sucursalId: string): Promise<void>;
}

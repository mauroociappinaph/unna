import { Inject, Injectable } from '@nestjs/common';
import {
  CategoryRepositoryPort,
  DEFAULT_PREPARATION_MINUTES,
  ModifierGroup,
  ModifierGroupRepositoryPort,
  Product,
  ProductRepositoryPort,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { PreorderLocalLookup } from './preorder-local-lookup';

export interface PublicMenuModifierGroup {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  options: Array<{ id: string; name: string; priceDelta: number }>;
}

export interface PublicMenuProduct {
  id: string;
  name: string;
  description: string | null;
  /** Catalog base price in cents, before IVA (as in the POS); the order adds `taxRate` per line. */
  price: number;
  /** IVA percentage the order adds on top of `price` and the option deltas, rounded per line. */
  taxRate: number;
  categoryId: string | null;
  imageUrl: string | null;
  modifierGroups: PublicMenuModifierGroup[];
}

export interface PublicMenu {
  businessName: string;
  sucursalName: string;
  accepting: boolean;
  reason: string | null;
  estimatedMinutes: number;
  categories: Array<{ id: string; name: string }>;
  products: PublicMenuProduct[];
}

/**
 * Menu of a sucursal's public link (S20): products for sale with their active modifiers. It loads
 * even when the local does not take orders, with `accepting: false` and the reason.
 */
@Injectable()
export class PublicMenuUseCase {
  constructor(
    private readonly locals: PreorderLocalLookup,
    @Inject('CategoryRepositoryPort') private readonly categories: Pick<CategoryRepositoryPort, 'findActiveByBusinessId'>,
    @Inject('ProductRepositoryPort') private readonly products: Pick<ProductRepositoryPort, 'findActiveByBusinessId'>,
    @Inject('ModifierGroupRepositoryPort') private readonly modifierGroups: Pick<ModifierGroupRepositoryPort, 'findActiveByBusinessId'>,
  ) {}

  async menu(slug: string, now = new Date()): Promise<UseCaseResult<PublicMenu>> {
    const found = await this.locals.find(slug);
    if (!found.ok) return { ok: false, error: found.error };
    const local = found.value!;

    const [reason, categories, products, groups] = await Promise.all([
      this.locals.notAcceptingReason(local, now),
      this.categories.findActiveByBusinessId(local.businessId),
      this.products.findActiveByBusinessId(local.businessId),
      this.modifierGroups.findActiveByBusinessId(local.businessId),
    ]);
    const forSale = products.filter((p) => p.canBeSold());
    const groupsById = new Map(groups.map((g) => [g.id, g]));
    const usedCategories = new Set(forSale.map((p) => p.categoryId));

    return {
      ok: true,
      value: {
        businessName: local.businessName,
        sucursalName: local.name,
        accepting: reason === null,
        reason,
        estimatedMinutes: DEFAULT_PREPARATION_MINUTES,
        categories: categories.filter((c) => usedCategories.has(c.id)).map((c) => ({ id: c.id, name: c.name })),
        products: forSale.map((p) => toMenuProduct(p, groupsById)),
      },
    };
  }
}

function toMenuProduct(product: Product, groupsById: Map<string, ModifierGroup>): PublicMenuProduct {
  const groups = product.modifierGroupIds.map((id) => groupsById.get(id)).filter((g): g is ModifierGroup => g !== undefined);
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    price: product.basePrice.toCents(),
    taxRate: product.taxRate,
    categoryId: product.categoryId ?? null,
    imageUrl: product.images[0] ?? null,
    modifierGroups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      minSelection: g.minSelection,
      maxSelection: g.maxSelection,
      isRequired: g.isRequired,
      options: g.options.filter((o) => o.isActive).map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
    })),
  };
}

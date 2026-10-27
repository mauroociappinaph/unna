import { ModifierGroupRepositoryPort, Money, NotFoundError, Order, ProductRepositoryPort } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

export interface OrderLineInput {
  productId: string;
  quantity: number;
  notes?: string;
  modifiers?: Array<{ modifierGroupId: string; optionId: string }>;
}

/** A priced order line; the order assigns its own id to it. */
export type NewOrderLine = Parameters<Order['addItem']>[0];

/**
 * The priced line, with the product's preparation time. On failure, `unavailable` marks the catalog
 * no longer offering what was chosen (product not for sale, modifier or option gone), as opposed to
 * an invalid choice (quantity, min/max options).
 */
export type PricedOrderLine = UseCaseResult<NewOrderLine> & { unavailable?: boolean; preparationTimeMinutes?: number };

/** The catalog lookups a line needs, scoped to the business. */
export interface OrderLineCatalog {
  products: Pick<ProductRepositoryPort, 'findByIdAndBusinessId'>;
  modifierGroups: Pick<ModifierGroupRepositoryPort, 'findByIdAndBusinessId'>;
}

const invalid = (message: string): PricedOrderLine => ({ ok: false, error: new Error(message) });
const unavailable = (error: Error): PricedOrderLine => ({ ok: false, error, unavailable: true });

/**
 * Prices a line from the catalog of the business, never from the client: product, modifier groups
 * and chosen options. Shared by the POS and the pedido anticipado (S20).
 */
export async function priceOrderLine(catalog: OrderLineCatalog, businessId: string, line: OrderLineInput): Promise<PricedOrderLine> {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) return invalid('La cantidad debe ser un entero positivo');
  const product = await catalog.products.findByIdAndBusinessId(line.productId, businessId);
  if (!product) return unavailable(new NotFoundError(`Producto ${line.productId} no encontrado`));
  if (!product.canBeSold()) return unavailable(new Error(`El producto "${product.name}" no está disponible para la venta`));

  const groups = await Promise.all(product.modifierGroupIds.map((id) => catalog.modifierGroups.findByIdAndBusinessId(id, businessId)));

  const modifiers: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }> = [];
  for (const choice of line.modifiers ?? []) {
    const group = groups.find((g) => g?.id === choice.modifierGroupId && g.isActive);
    if (!group) return unavailable(new Error(`El modificador ${choice.modifierGroupId} no aplica a "${product.name}"`));
    const option = group.options.find((o) => o.id === choice.optionId && o.isActive);
    if (!option) return unavailable(new NotFoundError(`Opción ${choice.optionId} no encontrada en "${group.name}"`));
    // A repeated option would add its delta again and count twice toward the group's min/max.
    if (modifiers.some((m) => m.modifierGroupId === group.id && m.optionId === option.id)) {
      return invalid(`La opción "${option.name}" está repetida en "${group.name}"`);
    }
    modifiers.push({ modifierGroupId: group.id, optionId: option.id, name: option.name, priceDelta: option.priceDelta });
  }

  for (const group of groups) {
    if (!group || !group.isActive) continue;
    const count = modifiers.filter((m) => m.modifierGroupId === group.id).length;
    const min = group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;
    if (count < min) return invalid(`Elegí al menos ${min} opción(es) de "${group.name}"`);
    if (group.maxSelection > 0 && count > group.maxSelection) {
      return invalid(`Podés elegir hasta ${group.maxSelection} opción(es) de "${group.name}"`);
    }
  }

  // Deltas can be negative ("sin X" options), so add them in cents and validate only the final price.
  const unitCents = modifiers.reduce((sum, m) => sum + m.priceDelta, product.basePrice.amount);
  if (unitCents < 0) return invalid(`El precio de "${product.name}" con sus modificadores no puede ser negativo`);
  const unitPrice = Money.fromCents(unitCents, product.basePrice.currency);
  const totalPrice = unitPrice.multiply(line.quantity);
  return {
    ok: true,
    preparationTimeMinutes: product.preparationTimeMinutes,
    value: {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      quantity: line.quantity,
      unitPrice,
      totalPrice,
      taxRate: product.taxRate,
      taxAmount: totalPrice.percentage(product.taxRate),
      notes: line.notes,
      modifiers,
    },
  };
}

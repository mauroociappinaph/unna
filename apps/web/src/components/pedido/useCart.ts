import { useMemo, useState } from 'react';
import type { SelectedModifier } from '@/lib/api-types';
import type { CheckoutLineInput, PublicProduct } from '@/lib/public-order-api';

/** Limits of the checkout contract: quantities 1..20 per line, at most 30 lines. */
export const MAX_LINE_QUANTITY = 20;
export const MAX_LINES = 30;

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  /** Names of the chosen options, e.g. "Avena, Shot extra". */
  optionsLabel: string;
  modifiers: SelectedModifier[];
  /** Menu price plus the options, in cents; the server recomputes it at checkout. */
  unitPrice: number;
  quantity: number;
}

const lineKey = (productId: string, modifiers: SelectedModifier[]) =>
  [productId, ...modifiers.map((m) => `${m.modifierGroupId}:${m.optionId}`).sort()].join('|');

/** Option names and unit price (menu price plus the options) of a product with the chosen modifiers. */
export function describeChoice(product: PublicProduct, modifiers: SelectedModifier[]) {
  const chosen = product.modifierGroups.flatMap((group) =>
    group.options.filter((option) => modifiers.some((m) => m.modifierGroupId === group.id && m.optionId === option.id)),
  );
  return {
    optionsLabel: chosen.map((option) => option.name).join(', '),
    unitPrice: product.price + chosen.reduce((sum, option) => sum + option.priceDelta, 0),
  };
}

/** Cart of the public order page: same product and options add up in one line. */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = (product: PublicProduct, modifiers: SelectedModifier[]) => {
    const key = lineKey(product.id, modifiers);
    setLines((current) => {
      if (current.some((line) => line.key === key)) {
        return current.map((line) => (line.key === key ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + 1) } : line));
      }
      if (current.length >= MAX_LINES) return current;
      return [...current, { key, productId: product.id, name: product.name, modifiers, quantity: 1, ...describeChoice(product, modifiers) }];
    });
  };

  const changeQuantity = (key: string, delta: number) => {
    setLines((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + delta) } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  const total = useMemo(() => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [lines]);

  /** Lines in the checkout body shape; modifiers go only when there are some. */
  const checkoutItems = (): CheckoutLineInput[] =>
    lines.map(({ productId, quantity, modifiers }) => (modifiers.length > 0 ? { productId, quantity, modifiers } : { productId, quantity }));

  return { lines, total, full: lines.length >= MAX_LINES, add, changeQuantity, checkoutItems };
}

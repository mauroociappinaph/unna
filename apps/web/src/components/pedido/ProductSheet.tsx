'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { formatMoney, type SelectedModifier } from '@/lib/api-types';
import { isFull, isSatisfied, ruleText, toggleOption, type ModifierSelection } from '@/lib/modifier-rules';
import type { PublicProduct } from '@/lib/public-order-api';
import { describeChoice } from './useCart';

interface ProductSheetProps {
  product: PublicProduct;
  onConfirm: (modifiers: SelectedModifier[]) => void;
  onCancel: () => void;
}

/** Bottom sheet on the phone (centered dialog on wider screens) to choose the options of a product. */
export function ProductSheet({ product, onConfirm, onCancel }: ProductSheetProps) {
  const [selection, setSelection] = useState<ModifierSelection>({});
  const groups = product.modifierGroups;

  const chosenOf = (groupId: string) => selection[groupId] ?? [];
  const valid = groups.every((group) => isSatisfied(group, chosenOf(group.id).length));
  // Group order, then option order: the same choice always gives the same line.
  const modifiers = groups.flatMap((group) =>
    group.options.filter((option) => chosenOf(group.id).includes(option.id)).map((option) => ({ modifierGroupId: group.id, optionId: option.id })),
  );
  const price = describeChoice(product, modifiers).unitPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pedido-sheet-title"
        className="max-h-[90vh] w-full max-w-lg space-y-6 overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl"
      >
        <div>
          <h2 id="pedido-sheet-title" className="text-xl font-bold text-gray-900">{product.name}</h2>
          {product.description && <p className="mt-1 text-sm text-gray-600">{product.description}</p>}
        </div>
        {groups.map((group) => {
          const chosen = chosenOf(group.id);
          const full = isFull(group, chosen);
          return (
            <fieldset key={group.id} className="space-y-3">
              <legend className="font-semibold text-gray-900">{group.name}</legend>
              <p className={`text-sm ${isSatisfied(group, chosen.length) ? 'text-gray-500' : 'text-red-600'}`}>{ruleText(group)}</p>
              {group.options.map((option) => {
                const checked = chosen.includes(option.id);
                return (
                  <Checkbox
                    key={option.id}
                    id={`pedido-mod-${group.id}-${option.id}`}
                    label={option.name}
                    description={option.priceDelta > 0 ? `+ ${formatMoney(option.priceDelta)}` : undefined}
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => setSelection((current) => ({ ...current, [group.id]: toggleOption(group, current[group.id] ?? [], option.id) }))}
                  />
                );
              })}
            </fieldset>
          );
        })}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!valid} onClick={() => valid && onConfirm(modifiers)}>
            Agregar al pedido · {formatMoney(price)}
          </Button>
        </div>
      </div>
    </div>
  );
}

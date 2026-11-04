'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { formatMoney, type ModifierGroup, type Product, type SelectedModifier } from '@/lib/api-types';
import { isFull, isSatisfied, ruleText, toggleOption, type ModifierSelection } from '@/lib/modifier-rules';

interface ModifierDialogProps {
  product: Product;
  groups: ModifierGroup[];
  onConfirm: (modifiers: SelectedModifier[]) => void;
  onCancel: () => void;
}

function initialSelection(groups: ModifierGroup[]): ModifierSelection {
  return Object.fromEntries(
    groups.map((g) => [g.id, g.options.filter((o) => o.isDefault).slice(0, g.maxSelection).map((o) => o.id)]),
  );
}

export function ModifierDialog({ product, groups, onConfirm, onCancel }: ModifierDialogProps) {
  const productGroups = product.modifierGroupIds
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is ModifierGroup => !!g && g.isActive)
    .map((g) => ({ ...g, options: g.options.filter((o) => o.isActive) }));
  const [selection, setSelection] = useState<ModifierSelection>(() => initialSelection(productGroups));

  const toggle = (group: ModifierGroup, optionId: string) => {
    setSelection((current) => ({ ...current, [group.id]: toggleOption(group, current[group.id] ?? [], optionId) }));
  };

  const valid = productGroups.every((g) => isSatisfied(g, (selection[g.id] ?? []).length));

  const handleConfirm = () => {
    if (!valid) return;
    onConfirm(productGroups.flatMap((g) => (selection[g.id] ?? []).map((optionId) => ({ modifierGroupId: g.id, optionId }))));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-modifier-title"
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6"
      >
        <h2 id="pos-modifier-title" className="text-xl font-bold text-gray-900">{product.name}</h2>
        {productGroups.map((group) => {
          const chosen = selection[group.id] ?? [];
          const full = isFull(group, chosen);
          return (
            <fieldset key={group.id} className="space-y-3">
              <legend className="font-semibold text-gray-900">{group.name}</legend>
              <p className={`text-sm ${isSatisfied(group, chosen.length) ? 'text-gray-500' : 'text-red-600'}`}>
                {ruleText(group)}
              </p>
              {group.options.map((option) => {
                const checked = chosen.includes(option.id);
                return (
                  <Checkbox
                    key={option.id}
                    id={`pos-mod-${group.id}-${option.id}`}
                    label={option.name}
                    description={option.priceDelta > 0 ? `+ ${formatMoney(option.priceDelta)}` : undefined}
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => toggle(group, option.id)}
                  />
                );
              })}
            </fieldset>
          );
        })}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!valid} onClick={handleConfirm}>Agregar al pedido</Button>
        </div>
      </div>
    </div>
  );
}

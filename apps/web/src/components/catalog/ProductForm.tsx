'use client';

import { FormEvent, useState } from 'react';
import { Button, Checkbox, Input } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { PRODUCT_STATUSES, type Category, type ModifierGroup, type Product, type ProductStatus } from '@/lib/api-types';
import { ErrorBanner } from './ErrorBanner';
import { PRODUCT_STATUS_LABELS } from './catalog-utils';
import { apiErrorMessage } from '@/lib/api-errors';
import { centsToInput, parsePesos } from '@/lib/money';

export interface ProductFormValues {
  name: string;
  categoryId: string;
  basePrice: number;
  taxRate: number;
  status: ProductStatus;
  modifierGroupIds: string[];
}

interface ProductFormProps {
  categories: Category[];
  modifierGroups: ModifierGroup[];
  initialData?: Product;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({ categories, modifierGroups, initialData, onSubmit, onCancel }: ProductFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? '');
  const [price, setPrice] = useState(initialData ? centsToInput(initialData.basePrice.amount) : '');
  const [taxRate, setTaxRate] = useState(String(initialData?.taxRate ?? 21));
  const [status, setStatus] = useState<ProductStatus>(initialData?.status ?? 'active');
  const [modifierGroupIds, setModifierGroupIds] = useState<string[]>(initialData?.modifierGroupIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleGroup = (groupId: string) => {
    setModifierGroupIds((ids) => (ids.includes(groupId) ? ids.filter((id) => id !== groupId) : [...ids, groupId]));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const basePrice = parsePesos(price);
    const tax = Number(taxRate);
    if (!name.trim()) return setError('Ingresá el nombre del producto');
    if (!categoryId) return setError('Elegí una categoría');
    if (basePrice === null || basePrice < 0) return setError('Ingresá un precio válido en pesos (por ejemplo 1.500 o 1500,50)');
    if (taxRate.trim() === '' || Number.isNaN(tax)) return setError('Ingresá una alícuota de IVA válida');

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), categoryId, basePrice, taxRate: tax, status, modifierGroupIds });
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el producto'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">{initialData ? `Editar: ${initialData.name}` : 'Nuevo producto'}</h2>
      <ErrorBanner message={error} />
      <Input id="product-name" label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <Select
        id="product-category"
        label="Categoría"
        placeholder="Elegí una categoría"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="product-price"
          label="Precio ($)"
          inputMode="decimal"
          placeholder="1500"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Input
          id="product-tax-rate"
          label="IVA (%)"
          inputMode="decimal"
          value={taxRate}
          onChange={(e) => setTaxRate(e.target.value)}
        />
      </div>
      <Select
        id="product-status"
        label="Estado"
        value={status}
        onChange={(e) => setStatus(e.target.value as ProductStatus)}
        options={PRODUCT_STATUSES.map((value) => ({ value, label: PRODUCT_STATUS_LABELS[value] }))}
      />
      {modifierGroups.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="label-field">Modificadores</legend>
          {modifierGroups.map((group) => (
            <Checkbox
              key={group.id}
              id={`product-modifier-${group.id}`}
              label={group.name}
              checked={modifierGroupIds.includes(group.id)}
              onChange={() => toggleGroup(group.id)}
            />
          ))}
        </fieldset>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}

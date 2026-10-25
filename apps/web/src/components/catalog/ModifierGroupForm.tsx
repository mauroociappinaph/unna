'use client';

import { FormEvent, useState } from 'react';
import { Button, Checkbox, Input } from '@/components/ui';
import type { ModifierGroupInput } from '@/lib/api-types';
import { ErrorBanner } from './ErrorBanner';
import { apiErrorMessage } from '@/lib/api-errors';
import { parsePesos } from '@/lib/money';

interface OptionRow {
  key: number;
  name: string;
  price: string;
}

interface ModifierGroupFormProps {
  onSubmit: (values: ModifierGroupInput) => Promise<void>;
  onCancel: () => void;
}

const isWholeNumber = (value: string) => /^\d+$/.test(value.trim());

export function ModifierGroupForm({ onSubmit, onCancel }: ModifierGroupFormProps) {
  const [name, setName] = useState('');
  const [minSelection, setMinSelection] = useState('0');
  const [maxSelection, setMaxSelection] = useState('1');
  const [isRequired, setIsRequired] = useState(false);
  const [rows, setRows] = useState<OptionRow[]>([{ key: 0, name: '', price: '' }]);
  const [nextKey, setNextKey] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateRow = (key: number, changes: Partial<OptionRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  };

  const addRow = () => {
    setRows((current) => [...current, { key: nextKey, name: '', price: '' }]);
    setNextKey((key) => key + 1);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Ingresá el nombre del grupo');
    if (!isWholeNumber(minSelection) || !isWholeNumber(maxSelection)) {
      return setError('El mínimo y el máximo tienen que ser números enteros');
    }
    const min = Number(minSelection);
    const max = Number(maxSelection);
    if (max < 1 || max < min) return setError('El máximo tiene que ser al menos 1 y no menor que el mínimo');

    const filledRows = rows.filter((row) => row.name.trim() || row.price.trim());
    if (filledRows.length === 0) return setError('Agregá al menos una opción');
    if (filledRows.some((row) => !row.name.trim())) return setError('Cada opción necesita un nombre');
    const deltas = filledRows.map((row) => (row.price.trim() ? parsePesos(row.price) : 0));
    if (deltas.some((delta) => delta === null)) {
      return setError('Ingresá precios válidos en pesos (por ejemplo 1.500 o 1500,50; podés usar negativos, como -150)');
    }
    const options = filledRows.map((row, i) => ({ name: row.name.trim(), priceDelta: deltas[i] ?? 0 }));

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), minSelection: min, maxSelection: max, isRequired, options });
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el grupo'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Nuevo grupo de modificadores</h2>
      <ErrorBanner message={error} />
      <Input id="group-name" label="Nombre del grupo" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input id="group-min" label="Mínimo" inputMode="numeric" value={minSelection} onChange={(e) => setMinSelection(e.target.value)} />
        <Input id="group-max" label="Máximo" inputMode="numeric" value={maxSelection} onChange={(e) => setMaxSelection(e.target.value)} />
      </div>
      <Checkbox
        id="group-required"
        label="Obligatorio"
        description="El cliente tiene que elegir al menos el mínimo de opciones."
        checked={isRequired}
        onChange={(e) => setIsRequired(e.target.checked)}
      />
      <fieldset className="space-y-3">
        <legend className="label-field">Opciones</legend>
        <p className="text-sm text-gray-500">Usá un precio negativo para opciones como &quot;sin queso&quot;.</p>
        {rows.map((row, index) => (
          <div key={row.key} className="flex items-end gap-2">
            <Input
              id={`group-option-name-${row.key}`}
              label={`Opción ${index + 1}`}
              value={row.name}
              onChange={(e) => updateRow(row.key, { name: e.target.value })}
            />
            <Input
              id={`group-option-price-${row.key}`}
              label={`Precio opción ${index + 1} ($)`}
              inputMode="decimal"
              placeholder="0"
              value={row.price}
              onChange={(e) => updateRow(row.key, { price: e.target.value })}
            />
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Quitar opción ${index + 1}`}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              >
                Quitar
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>Agregar opción</Button>
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}

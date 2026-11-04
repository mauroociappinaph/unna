'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney, type ModifierGroup, type ModifierGroupInput, type ModifierOptionInput } from '@/lib/api-types';
import { ErrorBanner } from './ErrorBanner';
import { Modal } from './Modal';
import { ModifierGroupForm } from './ModifierGroupForm';
import { apiErrorMessage } from '@/lib/api-errors';
import { parsePesos } from '@/lib/money';

const formatDelta = (cents: number) => `${cents > 0 ? '+' : ''}${formatMoney(cents)}`;

interface AddOptionFormProps {
  groupId: string;
  onAdd: (option: ModifierOptionInput) => Promise<boolean>;
  onInvalid: (message: string) => void;
}

function AddOptionForm({ groupId, onAdd, onInvalid }: AddOptionFormProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const priceDelta = price.trim() ? parsePesos(price) : 0;
    if (!name.trim()) return onInvalid('Ingresá el nombre de la opción');
    if (priceDelta === null) return onInvalid('Ingresá un precio válido en pesos (por ejemplo 1.500 o 1500,50; podés usar negativos)');

    setSaving(true);
    const added = await onAdd({ name: name.trim(), priceDelta });
    setSaving(false);
    if (added) {
      setName('');
      setPrice('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 pt-3 border-t border-gray-100">
      <Input id={`new-option-name-${groupId}`} label="Nueva opción" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        id={`new-option-price-${groupId}`}
        label="Precio ($)"
        inputMode="decimal"
        placeholder="0"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <Button type="submit" variant="outline" size="sm" loading={saving}>Agregar</Button>
    </form>
  );
}

export function ModifiersTab({ businessId }: { businessId: string }) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      setGroups(await api.listModifierGroups(businessId));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los modificadores'));
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (action: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
      return false;
    }
  };

  const handleCreate = async (values: ModifierGroupInput) => {
    await api.createModifierGroup(businessId, values);
    setShowForm(false);
    await load();
  };

  const handleDeleteGroup = (group: ModifierGroup) => {
    if (!confirm(`¿Eliminar el grupo "${group.name}" y todas sus opciones?`)) return;
    runAction(() => api.deleteModifierGroup(businessId, group.id), 'No se pudo eliminar el grupo');
  };

  return (
    <section>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowForm(true)}>Nuevo grupo</Button>
      </div>

      <ErrorBanner message={error} />

      {showForm && (
        <Modal>
          <ModifierGroupForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {isLoading ? (
        <p className="text-gray-500">Cargando modificadores…</p>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-600">
          No hay grupos de modificadores. Creá uno para ofrecer guarniciones, extras o variantes.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <article
              key={group.id}
              aria-labelledby={`group-title-${group.id}`}
              className="bg-white rounded-xl border border-gray-100 p-6 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 id={`group-title-${group.id}`} className="font-semibold text-gray-900">{group.name}</h3>
                  <p className="text-sm text-gray-500">
                    {group.isRequired ? 'Obligatorio' : 'Opcional'} · elegí entre {group.minSelection} y {group.maxSelection}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteGroup(group)}>
                  Eliminar grupo
                </Button>
              </div>
              <ul className="divide-y divide-gray-100">
                {group.options.map((option) => (
                  <li key={option.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-900">{option.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-gray-600">{formatDelta(option.priceDelta)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar ${option.name}`}
                        onClick={() =>
                          runAction(
                            () => api.removeModifierOption(businessId, group.id, option.id),
                            'No se pudo quitar la opción',
                          )
                        }
                      >
                        Quitar
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              <AddOptionForm
                groupId={group.id}
                onAdd={(option) =>
                  runAction(() => api.addModifierOption(businessId, group.id, option), 'No se pudo agregar la opción')
                }
                onInvalid={setError}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

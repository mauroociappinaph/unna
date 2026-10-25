'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { CATEGORY_TYPES, type Category, type CategoryInput, type CategoryType } from '@/lib/api-types';
import { ErrorBanner } from './ErrorBanner';
import { Modal } from './Modal';
import { CATEGORY_TYPE_LABELS } from './catalog-utils';
import { apiErrorMessage } from '@/lib/api-errors';

interface CategoryFormProps {
  initialData?: Category;
  onSubmit: (values: CategoryInput) => Promise<void>;
  onCancel: () => void;
}

function CategoryForm({ initialData, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [type, setType] = useState<CategoryType>(initialData?.type ?? 'plato');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Ingresá el nombre de la categoría');

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), type, ...(description.trim() ? { description: description.trim() } : {}) });
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar la categoría'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">{initialData ? `Editar: ${initialData.name}` : 'Nueva categoría'}</h2>
      <ErrorBanner message={error} />
      <Input id="category-name" label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <Select
        id="category-type"
        label="Tipo"
        value={type}
        onChange={(e) => setType(e.target.value as CategoryType)}
        options={CATEGORY_TYPES.map((value) => ({ value, label: CATEGORY_TYPE_LABELS[value] }))}
      />
      <Input id="category-description" label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}

export function CategoriesTab({ businessId }: { businessId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const load = useCallback(async () => {
    try {
      setCategories(await api.listCategories(businessId));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar las categorías'));
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (values: CategoryInput) => {
    if (editing) {
      await api.updateCategory(businessId, editing.id, values);
    } else {
      await api.createCategory(businessId, values);
    }
    closeForm();
    await load();
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    setError(null);
    try {
      await api.deleteCategory(businessId, category.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo eliminar la categoría'));
    }
  };

  return (
    <section>
      <div className="flex justify-end mb-6">
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>Nueva categoría</Button>
      </div>

      <ErrorBanner message={error} />

      {showForm && (
        <Modal>
          <CategoryForm initialData={editing ?? undefined} onSubmit={handleSubmit} onCancel={closeForm} />
        </Modal>
      )}

      {isLoading ? (
        <p className="text-gray-500">Cargando categorías…</p>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-600">
          No hay categorías. Creá una para ordenar tus productos.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{category.name}</td>
                  <td className="px-4 py-3">{CATEGORY_TYPE_LABELS[category.type] ?? category.type}</td>
                  <td className="px-4 py-3 text-gray-600">{category.description || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(category); setShowForm(true); }}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(category)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

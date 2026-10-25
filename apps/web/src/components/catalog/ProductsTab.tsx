'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { formatMoney, type Category, type ModifierGroup, type Product } from '@/lib/api-types';
import { ErrorBanner } from './ErrorBanner';
import { Modal } from './Modal';
import { ProductForm, type ProductFormValues } from './ProductForm';
import { PRODUCT_STATUS_LABELS } from './catalog-utils';
import { apiErrorMessage } from '@/lib/api-errors';

export function ProductsTab({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const load = useCallback(async () => {
    try {
      const [productList, categoryList, groupList] = await Promise.all([
        api.listProducts(businessId),
        api.listCategories(businessId),
        api.listModifierGroups(businessId),
      ]);
      setProducts(productList);
      setCategories(categoryList);
      setModifierGroups(groupList);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los productos'));
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const visibleProducts = categoryFilter ? products.filter((p) => p.categoryId === categoryFilter) : products;

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (values: ProductFormValues) => {
    if (editing) {
      await api.updateProduct(businessId, editing.id, values);
    } else {
      await api.createProduct(businessId, { ...values, type: 'simple' });
    }
    closeForm();
    await load();
  };

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    }
  };

  const handleArchive = (product: Product) => {
    if (!confirm(`¿Archivar "${product.name}"? No se va a poder vender hasta que lo actives.`)) return;
    runAction(() => api.updateProduct(businessId, product.id, { status: 'archived' }), 'No se pudo archivar el producto');
  };

  const handleDelete = (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    runAction(() => api.deleteProduct(businessId, product.id), 'No se pudo eliminar el producto');
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="w-64">
          <Select
            id="product-category-filter"
            label="Filtrar por categoría"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[{ value: '', label: 'Todas' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo producto</Button>
      </div>

      <ErrorBanner message={error} />

      {showForm && (
        <Modal>
          <ProductForm
            categories={categories}
            modifierGroups={modifierGroups}
            initialData={editing ?? undefined}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </Modal>
      )}

      {isLoading ? (
        <p className="text-gray-500">Cargando productos…</p>
      ) : visibleProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-600">
          No hay productos. Creá el primero para armar tu carta.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-3">{categoryNames.get(product.categoryId) ?? '—'}</td>
                  <td className="px-4 py-3">{formatMoney(product.basePrice.amount)}</td>
                  <td className="px-4 py-3">{PRODUCT_STATUS_LABELS[product.status]}</td>
                  <td className="px-4 py-3">{product.isActive ? 'Sí' : 'No'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(product); setShowForm(true); }}>
                        Editar
                      </Button>
                      {product.status !== 'archived' && (
                        <Button variant="ghost" size="sm" onClick={() => handleArchive(product)}>Archivar</Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(product)}>
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

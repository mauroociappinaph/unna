'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { formatMoney, type Category, type Product } from '@/lib/api-types';

interface ProductGridProps {
  categories: Category[];
  products: Product[];
  disabled: boolean;
  onSelect: (product: Product) => void;
}

interface ProductSection {
  id: string;
  name: string;
  products: Product[];
}

export function ProductGrid({ categories, products, disabled, onSelect }: ProductGridProps) {
  const [search, setSearch] = useState('');

  const sections = useMemo<ProductSection[]>(() => {
    const term = search.trim().toLowerCase();
    const visible = products
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    const ordered = [...categories].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    const known = new Set(ordered.map((c) => c.id));
    const result = ordered.map((c) => ({ id: c.id, name: c.name, products: visible.filter((p) => p.categoryId === c.id) }));
    result.push({ id: 'other', name: 'Otros', products: visible.filter((p) => !known.has(p.categoryId)) });
    return result.filter((s) => s.products.length > 0);
  }, [categories, products, search]);

  return (
    <div className="space-y-6">
      <Input
        id="pos-search"
        label="Buscar producto"
        value={search}
        placeholder="Nombre del producto"
        onChange={(e) => setSearch(e.target.value)}
      />
      {sections.length === 0 && (
        <p className="text-gray-500 text-sm">No hay productos activos que coincidan.</p>
      )}
      {sections.map((section) => (
        <div key={section.id}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{section.name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {section.products.map((product) => (
              <button
                key={product.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(product)}
                className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-unna-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="block font-semibold text-gray-900">{product.name}</span>
                <span className="block text-sm text-gray-500"> {formatMoney(product.basePrice.amount)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

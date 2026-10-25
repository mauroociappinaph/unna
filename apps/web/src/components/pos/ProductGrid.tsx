'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/Input';
import type { Category, Product } from '@/lib/api-types';
import { ProductCard } from './ProductCard';
import { compareByDisplayOrder } from './pos-format';

interface ProductGridProps {
  categories: Category[];
  products: Product[];
  disabled: boolean;
  /** Off while a dialog is open, so "/" does not jump behind it. */
  shortcutsEnabled: boolean;
  onSelect: (product: Product) => void;
}

interface ProductSection {
  id: string;
  name: string;
  products: Product[];
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

export function ProductGrid({ categories, products, disabled, shortcutsEnabled, onSelect }: ProductGridProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const sections = useMemo<ProductSection[]>(() => {
    const term = search.trim().toLowerCase();
    const visible = products
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .sort(compareByDisplayOrder);
    const ordered = [...categories].sort(compareByDisplayOrder);
    const known = new Set(ordered.map((c) => c.id));
    const result = ordered.map((c) => ({ id: c.id, name: c.name, products: visible.filter((p) => p.categoryId === c.id) }));
    result.push({ id: 'other', name: 'Otros', products: visible.filter((p) => !known.has(p.categoryId)) });
    return result.filter((s) => s.products.length > 0);
  }, [categories, products, search]);

  // "/" focuses the search from anywhere except another field.
  useEffect(() => {
    if (!shortcutsEnabled) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearch('');
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const first = sections[0]?.products[0];
    if (search.trim() && first && !disabled) onSelect(first);
  };

  return (
    <div className="space-y-6">
      <Input
        ref={searchRef}
        id="pos-search"
        label="Buscar producto"
        value={search}
        placeholder="Nombre del producto"
        helperText="Atajos: / para buscar, Enter agrega el primero, Esc limpia"
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleSearchKeyDown}
      />
      {sections.length === 0 && (
        <p className="text-gray-500 text-sm">No hay productos activos que coincidan.</p>
      )}
      {sections.map((section) => (
        <div key={section.id}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{section.name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {section.products.map((product) => (
              <ProductCard key={product.id} product={product} disabled={disabled} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

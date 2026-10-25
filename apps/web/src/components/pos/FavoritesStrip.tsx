import type { Product, TopSeller } from '@/lib/api-types';
import { ProductCard } from './ProductCard';
import { compareByDisplayOrder } from './pos-format';

export const MAX_FAVORITES = 8;

/** Pinned active products first, then top sellers still on sale, without duplicates (S13). */
export function selectFavorites(products: Product[], topSellers: TopSeller[], max = MAX_FAVORITES): Product[] {
  const onSale = products.filter((p) => p.isActive !== false);
  const pinned = onSale.filter((p) => p.isFavorite).sort(compareByDisplayOrder);
  const byId = new Map(onSale.map((p) => [p.id, p]));
  const sellers = topSellers.map((s) => byId.get(s.productId)).filter((p): p is Product => !!p);
  const unique = [...new Map([...pinned, ...sellers].map((p) => [p.id, p])).values()];
  return unique.slice(0, max);
}

interface FavoritesStripProps {
  favorites: Product[];
  disabled: boolean;
  onSelect: (product: Product) => void;
}

export function FavoritesStrip({ favorites, disabled, onSelect }: FavoritesStripProps) {
  if (favorites.length === 0) return null;
  return (
    <section aria-label="Favoritos" className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Favoritos</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {favorites.map((product) => (
          <ProductCard key={product.id} product={product} disabled={disabled} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

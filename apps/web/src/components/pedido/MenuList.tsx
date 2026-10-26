import { formatMoney } from '@/lib/api-types';
import type { PublicMenu, PublicProduct } from '@/lib/public-order-api';

interface MenuListProps {
  menu: PublicMenu;
  /** Without it the menu is read-only: the local is not taking orders or the cart is full. */
  onAdd: ((product: PublicProduct) => void) | null;
}

interface MenuSection {
  id: string;
  name: string;
  products: PublicProduct[];
}

/** Categories in the menu order; products without a category go last under "Otros". */
function sectionsOf(menu: PublicMenu): MenuSection[] {
  const known = new Set(menu.categories.map((c) => c.id));
  const sections = menu.categories.map((c) => ({ ...c, products: menu.products.filter((p) => p.categoryId === c.id) }));
  sections.push({ id: 'otros', name: 'Otros', products: menu.products.filter((p) => !p.categoryId || !known.has(p.categoryId)) });
  return sections.filter((s) => s.products.length > 0);
}

export function MenuList({ menu, onAdd }: MenuListProps) {
  return (
    <div className="space-y-8">
      {sectionsOf(menu).map((section) => (
        <section key={section.id} aria-labelledby={`pedido-cat-${section.id}`}>
          <h2 id={`pedido-cat-${section.id}`} className="text-lg font-bold text-gray-900">{section.name}</h2>
          <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
            {section.products.map((product) => (
              <li key={product.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{product.name}</p>
                  {product.description && <p className="mt-0.5 text-sm text-gray-600">{product.description}</p>}
                  <p className="mt-1 text-sm font-medium text-gray-900 tabular-nums">{formatMoney(product.price)}</p>
                </div>
                {onAdd && (
                  <button
                    type="button"
                    aria-label={`Agregar ${product.name}`}
                    onClick={() => onAdd(product)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-unna-green text-2xl font-bold leading-none text-unna-green-dark hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-unna-green focus:ring-offset-2"
                  >
                    +
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

import { formatMoney, type Product } from '@/lib/api-types';

interface ProductCardProps {
  product: Product;
  disabled: boolean;
  onSelect: (product: Product) => void;
}

export function ProductCard({ product, disabled, onSelect }: ProductCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(product)}
      className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-unna-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="block font-semibold text-gray-900">{product.name}</span>
      <span className="block text-sm text-gray-500"> {formatMoney(product.basePrice.amount)}</span>
    </button>
  );
}

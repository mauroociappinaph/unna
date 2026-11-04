'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatMoney, type Order } from '@/lib/api-types';
import { parsePesos } from '@/lib/money';

interface OrderSummaryProps {
  order: Order | null;
  locked: boolean;
  busy: boolean;
  onRemoveItem: (itemId: string) => void;
  onApplyDiscount: (cents: number) => void;
  onInvalidAmount: (message: string) => void;
}

export function OrderSummary({ order, locked, busy, onRemoveItem, onApplyDiscount, onInvalidAmount }: OrderSummaryProps) {
  const [discount, setDiscount] = useState('');

  const handleDiscount = () => {
    const cents = parsePesos(discount);
    if (cents === null || cents < 0) {
      onInvalidAmount('Ingresá un descuento válido en pesos (0 lo quita).');
      return;
    }
    onApplyDiscount(cents);
  };

  if (!order || order.items.length === 0) {
    return <p className="text-gray-500 text-sm">Agregá productos para armar el pedido.</p>;
  }

  const rows: Array<[string, string]> = [
    ['Subtotal', formatMoney(order.subtotal.amount)],
    ['IVA', formatMoney(order.taxAmount.amount)],
    ['Descuento', formatMoney(order.discountAmount.amount)],
  ];

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-100">
        {order.items.map((item) => (
          <li key={item.id} className="py-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900">{item.productName}</p>
              <p className="text-sm text-gray-500">{item.quantity} × {formatMoney(item.unitPrice.amount)}</p>
              {item.modifiers.length > 0 && (
                <p className="text-sm text-gray-500">{item.modifiers.map((m) => m.name).join(', ')}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{formatMoney(item.totalPrice.amount)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                aria-label={`Quitar ${item.productName}`}
                disabled={locked || busy}
                onClick={() => onRemoveItem(item.id)}
              >
                ✕
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-end gap-2">
        <Input
          id="pos-discount"
          label="Descuento ($)"
          inputMode="decimal"
          value={discount}
          disabled={locked}
          onChange={(e) => setDiscount(e.target.value)}
        />
        <Button variant="outline" disabled={locked || busy} onClick={handleDiscount}>
          Aplicar descuento
        </Button>
      </div>

      <section aria-label="Totales" className="border-t border-gray-100 pt-4 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm text-gray-600">
            <span>{label}</span>
            <span>{value}</span>
          </div>
        ))}
        <div className="flex justify-between text-lg font-bold text-gray-900">
          <span>Total</span>
          <span>{formatMoney(order.totalAmount.amount)}</span>
        </div>
      </section>
    </div>
  );
}

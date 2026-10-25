import { formatMoney, type Receipt } from '@/lib/api-types';

export function ReceiptView({ receipt }: { receipt: Receipt }) {
  return (
    <section aria-label="Comprobante" className="bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm space-y-2">
      <p className="font-bold">Ticket N° {receipt.receiptNumber}</p>
      <p>Punto de venta: {receipt.pointOfSale}</p>
      <p>Pedido {receipt.orderNumber}</p>
      <ul className="border-t border-dashed border-gray-300 pt-2 space-y-1">
        {receipt.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span>{item.quantity} × {item.productName}</span>
            <span>{formatMoney(item.totalPrice.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-dashed border-gray-300 pt-2 flex justify-between font-bold">
        <span>Total</span>
        <span>{formatMoney(receipt.totalAmount.amount)}</span>
      </div>
    </section>
  );
}

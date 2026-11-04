import { formatMoney, type Receipt } from '@/lib/api-types';
import { formatDate, RECEIPT_TYPE_LABELS, receiptNumberLabel } from './pos-format';

export function ReceiptView({ receipt }: { receipt: Receipt }) {
  const fiscal = receipt.type !== 'ticket';
  // A and B discriminate IVA; C (monotributo/exento) shows only the total.
  const discriminatesIva = (receipt.type === 'A' || receipt.type === 'B') && receipt.ivaBreakdown.length > 0;

  return (
    <section aria-label="Comprobante" className="bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm space-y-2">
      <p className="font-bold">{RECEIPT_TYPE_LABELS[receipt.type]} N° {receiptNumberLabel(receipt)}</p>
      <p>Punto de venta: {receipt.pointOfSale}</p>
      <p>Pedido {receipt.orderNumber}</p>
      {receipt.type === 'A' && receipt.customerName && (
        <p>Cliente: {receipt.customerName} · CUIT {receipt.customerTaxId ?? receipt.docNumber}</p>
      )}
      <ul className="border-t border-dashed border-gray-300 pt-2 space-y-1">
        {receipt.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span>{item.quantity} × {item.productName}</span>
            <span>{formatMoney(item.totalPrice.amount)}</span>
          </li>
        ))}
      </ul>
      {discriminatesIva && (
        <ul className="border-t border-dashed border-gray-300 pt-2 space-y-1">
          {receipt.netAmount && (
            <li className="flex justify-between gap-2">
              <span>Neto gravado</span>
              <span>{formatMoney(receipt.netAmount.amount)}</span>
            </li>
          )}
          {receipt.ivaBreakdown.map((line) => (
            <li key={line.rate} className="flex justify-between gap-2">
              <span>IVA {line.rate}%</span>
              <span>{formatMoney(line.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-dashed border-gray-300 pt-2 flex justify-between font-bold">
        <span>Total</span>
        <span>{formatMoney(receipt.totalAmount.amount)}</span>
      </div>
      {fiscal && receipt.cae && (
        <div className="border-t border-dashed border-gray-300 pt-2 space-y-1">
          <p>CAE: {receipt.cae}</p>
          {receipt.caeExpiration && <p>Vencimiento CAE: {formatDate(receipt.caeExpiration)}</p>}
          {receipt.qrCode && (
            <a href={receipt.qrCode} target="_blank" rel="noopener noreferrer" className="font-sans font-semibold text-unna-green-dark underline">
              Verificar en ARCA
            </a>
          )}
        </div>
      )}
    </section>
  );
}

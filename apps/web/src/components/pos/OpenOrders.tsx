import { formatMoney, type OrderSummary } from '@/lib/api-types';
import { CLOSED_STATUSES, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from './pos-format';

/** Orders created today that are not delivered, cancelled or refunded. */
export function selectOpenOrders(orders: OrderSummary[], now = new Date()): OrderSummary[] {
  const today = now.toDateString();
  return orders.filter((o) => !CLOSED_STATUSES.includes(o.status) && new Date(o.createdAt).toDateString() === today);
}

interface OpenOrdersProps {
  orders: OrderSummary[];
  loading: boolean;
  onResume: (order: OrderSummary) => void;
}

export function OpenOrders({ orders, loading, onResume }: OpenOrdersProps) {
  return (
    <section aria-label="Pedidos abiertos" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <h2 className="font-semibold text-gray-900">Pedidos abiertos de hoy</h2>
      {loading && <p className="text-sm text-gray-500">Cargando pedidos…</p>}
      {!loading && orders.length === 0 && <p className="text-sm text-gray-500">No hay pedidos abiertos.</p>}
      {orders.map((order) => (
        <button
          key={order.id}
          type="button"
          onClick={() => onResume(order)}
          className="w-full text-left flex justify-between gap-2 border border-gray-100 rounded-lg p-3 hover:border-unna-green"
        >
          <span>
            #{order.orderNumber} · {ORDER_TYPE_LABELS[order.type]}
            {order.tableNumber ? ` · Mesa ${order.tableNumber}` : ''} · {ORDER_STATUS_LABELS[order.status]}
          </span>
          <span className="font-medium">{formatMoney(order.totalAmount.amount)}</span>
        </button>
      ))}
    </section>
  );
}

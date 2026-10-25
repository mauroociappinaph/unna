import { Button } from '@/components/ui/Button';
import type { Order, OrderAction } from '@/lib/api-types';
import { OrderStatusActions } from './OrderStatusActions';
import { OrderSummary } from './OrderSummary';

interface OrderPanelProps {
  order: Order | null;
  locked: boolean;
  busy: boolean;
  canCharge: boolean;
  chargeDisabled: boolean;
  onStatus: (action: OrderAction, reason?: string) => void;
  onRemoveItem: (itemId: string) => void;
  onApplyDiscount: (cents: number) => void;
  onInvalidAmount: (message: string) => void;
  onCharge: () => void;
}

export function OrderPanel({
  order, locked, busy, canCharge, chargeDisabled, onStatus, onRemoveItem, onApplyDiscount, onInvalidAmount, onCharge,
}: OrderPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {order ? `Pedido ${order.orderNumber}` : 'Pedido nuevo'}
      </h2>
      {order && <OrderStatusActions key={`status-${order.id}`} order={order} busy={busy} onAction={onStatus} />}
      <OrderSummary
        key={`summary-${order?.id ?? 'new'}`}
        order={order}
        locked={locked}
        busy={busy}
        onRemoveItem={onRemoveItem}
        onApplyDiscount={onApplyDiscount}
        onInvalidAmount={onInvalidAmount}
      />
      {canCharge && (
        <Button className="w-full" disabled={chargeDisabled} onClick={onCharge}>Cobrar</Button>
      )}
    </div>
  );
}

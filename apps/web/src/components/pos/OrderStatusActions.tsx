'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Order, OrderAction } from '@/lib/api-types';
import { ACTION_LABELS, CLOSED_STATUSES, NEXT_ACTION, ORDER_STATUS_LABELS } from './pos-format';

interface OrderStatusActionsProps {
  order: Order;
  busy: boolean;
  onAction: (action: OrderAction, reason?: string) => void;
}

export function OrderStatusActions({ order, busy, onAction }: OrderStatusActionsProps) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const next = NEXT_ACTION[order.status];
  const closed = CLOSED_STATUSES.includes(order.status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-1 text-xs font-medium bg-unna-green/10 text-unna-green rounded-full">
          {ORDER_STATUS_LABELS[order.status]}
        </span>
        {next && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction(next)}>
            {ACTION_LABELS[next]}
          </Button>
        )}
        {!closed && !cancelling && (
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setCancelling(true)}>
            Cancelar pedido
          </Button>
        )}
      </div>
      {!closed && cancelling && (
        <div className="flex items-end gap-2">
          <Input
            id="pos-cancel-reason"
            label="Motivo de cancelación"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            disabled={busy || !reason.trim()}
            onClick={() => onAction('cancel', reason.trim())}
          >
            Confirmar cancelación
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCancelling(false); setReason(''); }}>
            Volver
          </Button>
        </div>
      )}
    </div>
  );
}

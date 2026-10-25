import { Button } from '@/components/ui/Button';
import { ORDER_TYPE_LABELS } from '@/components/pos/pos-format';
import type { BarTicket } from '@/lib/order-board-api';
import { DELAYED_AFTER_MINUTES, elapsedLabel, elapsedMinutes } from './bar-format';

interface BarTicketCardProps {
  ticket: BarTicket;
  now: number;
  actionLabel: string;
  busy: boolean;
  onAction: (ticket: BarTicket) => void;
}

export function BarTicketCard({ ticket, now, actionLabel, busy, onAction }: BarTicketCardProps) {
  const minutes = elapsedMinutes(ticket.createdAt, now);
  const delayed = minutes > DELAYED_AFTER_MINUTES;
  const typeLabel = ORDER_TYPE_LABELS[ticket.type] ?? ticket.type;

  return (
    <article
      aria-label={`Pedido ${ticket.shortNumber}`}
      className={`rounded-2xl border-2 bg-white p-4 ${delayed ? 'border-amber-500 bg-amber-50' : 'border-gray-100'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-4xl font-extrabold text-gray-900 leading-none">{ticket.shortNumber}</p>
          <p className="mt-1 font-semibold text-gray-900">{ticket.customerName || 'Sin nombre'}</p>
          <p className="text-sm text-gray-600">{ticket.tableNumber ? `${typeLabel} · Mesa ${ticket.tableNumber}` : typeLabel}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm ${delayed ? 'font-semibold text-amber-800' : 'text-gray-600'}`}>{elapsedLabel(minutes)}</p>
          {delayed && <span className="mt-1 inline-block rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">Demorado</span>}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {ticket.items.map((item, i) => (
          <li key={i}>
            <p className="font-medium text-gray-900">{`${item.quantity}× ${item.productName}`}</p>
            {item.modifiers.length > 0 && <p className="text-sm text-gray-600">{item.modifiers.join(', ')}</p>}
            {item.notes && <p className="text-sm italic text-gray-700">{`Nota: ${item.notes}`}</p>}
          </li>
        ))}
      </ul>

      <Button className="mt-4 w-full" size="sm" disabled={busy} onClick={() => onAction(ticket)}>
        {actionLabel}
      </Button>
    </article>
  );
}

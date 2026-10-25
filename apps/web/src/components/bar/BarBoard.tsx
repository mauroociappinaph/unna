'use client';

import { useCallback, useRef, useState } from 'react';
import { ErrorBanner } from '@/components/catalog/ErrorBanner';
import { usePolling } from '@/components/board/usePolling';
import type { OrderAction, OrderStatus } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import { changeOrderStatus, getBarQueue, type BarQueue, type BarTicket } from '@/lib/order-board-api';
import { BAR_POLL_MS, startActions } from './bar-format';
import { BarTicketCard } from './BarTicketCard';

type Column = keyof BarQueue;

interface ColumnConfig {
  key: Column;
  title: string;
  actionLabel: string;
  /** Where the ticket goes after the action; null once it leaves the bar. */
  next: { column: Column; status: OrderStatus } | null;
  actions: (ticket: BarTicket) => OrderAction[];
}

const COLUMNS: ColumnConfig[] = [
  { key: 'new', title: 'Nuevos', actionLabel: 'Empezar', next: { column: 'preparing', status: 'preparing' }, actions: (t) => startActions(t.status) },
  { key: 'preparing', title: 'En preparación', actionLabel: 'Listo', next: { column: 'ready', status: 'ready' }, actions: () => ['ready'] },
  { key: 'ready', title: 'Listos', actionLabel: 'Entregado', next: null, actions: () => ['deliver'] },
];

interface BarBoardProps {
  businessId: string;
  sucursalId: string;
}

export function BarBoard({ businessId, sucursalId }: BarBoardProps) {
  const [queue, setQueue] = useState<BarQueue | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  // Bumped on every optimistic move so a response requested before it is discarded.
  const version = useRef(0);

  const load = useCallback(async () => {
    const requested = version.current;
    try {
      const next = await getBarQueue(businessId, sucursalId);
      if (requested !== version.current) return;
      setQueue(next);
      setNow(Date.now());
      setLoadError(null);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'No se pudo actualizar la barra'));
    }
  }, [businessId, sucursalId]);

  usePolling(load, BAR_POLL_MS);

  const handleAction = async (config: ColumnConfig, ticket: BarTicket) => {
    version.current += 1;
    setActionError(null);
    setBusyIds((ids) => [...ids, ticket.id]);
    setQueue((current) => {
      if (!current) return current;
      const moved = { ...current, [config.key]: current[config.key].filter((t) => t.id !== ticket.id) };
      if (config.next) moved[config.next.column] = [...current[config.next.column], { ...ticket, status: config.next.status }];
      return moved;
    });

    try {
      for (const action of config.actions(ticket)) {
        await changeOrderStatus(businessId, ticket.id, action);
      }
    } catch (err) {
      setActionError(apiErrorMessage(err, 'No se pudo actualizar el pedido'));
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== ticket.id));
    }
    version.current += 1;
    await load();
  };

  return (
    <div>
      <ErrorBanner message={actionError ?? loadError} />
      {!queue ? (
        <p className="text-gray-500">{loadError ? '' : 'Cargando pedidos…'}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((config) => (
            <section key={config.key} aria-label={config.title} className="rounded-2xl bg-gray-100 p-4">
              <h2 className="mb-4 flex items-center justify-between text-lg font-bold text-gray-900">
                {config.title}
                <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold text-gray-700" aria-hidden="true">
                  {queue[config.key].length}
                </span>
              </h2>
              <div className="space-y-3">
                {queue[config.key].length === 0 && <p className="text-sm text-gray-500">Sin pedidos</p>}
                {queue[config.key].map((ticket) => (
                  <BarTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    now={now}
                    actionLabel={config.actionLabel}
                    busy={busyIds.includes(ticket.id)}
                    onAction={(t) => handleAction(config, t)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

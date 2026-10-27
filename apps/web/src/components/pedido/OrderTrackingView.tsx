'use client';

import { formatMoney } from '@/lib/api-types';
import type { OrderTracking, TrackingStatus } from '@/lib/public-order-api';
import { PublicOrderHeader } from './PublicOrderHeader';
import { useOrderTracking } from './useOrderTracking';

const STEPS: { status: TrackingStatus; label: string }[] = [
  { status: 'awaiting_payment', label: 'Pago pendiente' },
  { status: 'received', label: 'Recibido' },
  { status: 'preparing', label: 'En preparación' },
  { status: 'ready', label: 'Listo para retirar' },
];

/** What the customer reads under the steps, or instead of them on a final state. */
const MESSAGES: Record<TrackingStatus, string> = {
  awaiting_payment: 'Estamos esperando la confirmación de Mercado Pago.',
  received: 'Recibimos tu pedido y tu pago.',
  preparing: 'Estamos preparando tu pedido.',
  ready: '¡Tu pedido está listo! Acercate a retirarlo.',
  delivered: 'Pedido entregado. ¡Que lo disfrutes!',
  cancelled: 'El pedido fue cancelado. Si ya lo pagaste, consultá en el local por la devolución.',
  expired: 'El pedido venció sin pago. Si todavía lo querés, hacelo de nuevo desde el menú.',
  payment_failed: 'El pago no se completó. Podés volver a hacer el pedido desde el menú.',
};

/** Orders that will not be prepared: no steps, the message says what happened. */
const NO_STEPS: ReadonlySet<TrackingStatus> = new Set(['cancelled', 'expired', 'payment_failed']);

function Steps({ status }: { status: TrackingStatus }) {
  const reached = status === 'delivered' ? STEPS.length : STEPS.findIndex((step) => step.status === status);
  return (
    <ol aria-label="Estado del pedido" className="space-y-3">
      {STEPS.map((step, index) => {
        const current = index === reached;
        const done = index < reached;
        return (
          <li key={step.status} aria-current={current ? 'step' : undefined} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 rounded-full border-2 ${current || done ? 'border-unna-green bg-unna-green' : 'border-gray-300 bg-white'}`}
            />
            <span className={current ? 'font-bold text-unna-green-dark' : done ? 'text-gray-900' : 'text-gray-500'}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function TrackingDetails({ tracking }: { tracking: OrderTracking }) {
  const showEta = tracking.estimatedMinutes !== null && (tracking.status === 'received' || tracking.status === 'preparing');
  const failed = NO_STEPS.has(tracking.status);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
        <p className="text-sm text-gray-600">Pedido de {tracking.customerFirstName}</p>
        {tracking.orderNumber && (
          <>
            <p className="mt-2 text-sm font-medium text-gray-600">Número de pedido</p>
            <p className="text-5xl font-black tabular-nums text-gray-900">{tracking.orderNumber}</p>
          </>
        )}
        <p role="status" className={`mt-4 text-lg font-semibold ${failed ? 'text-red-700' : 'text-gray-900'}`}>
          {MESSAGES[tracking.status]}
        </p>
        {showEta && <p className="mt-1 text-gray-600">Listo en unos {tracking.estimatedMinutes} min</p>}
      </div>

      {!failed && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <Steps status={tracking.status} />
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="font-bold text-gray-900">Tu pedido</h2>
        <ul className="mt-3 space-y-1 text-gray-900">
          {tracking.items.map((item, index) => (
            <li key={`${item.name}-${index}`}>{`${item.name} × ${item.quantity}`}</li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-bold text-gray-900">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(tracking.total)}</span>
        </div>
      </div>
    </div>
  );
}

/** Tracking page of a pedido anticipado (S20): updates itself until the order reaches a final state. */
export function OrderTrackingView({ token }: { token: string }) {
  const { tracking, notFound, loadError } = useOrderTracking(token);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* The tracking reply has no café name; the sucursal is where the customer picks the order up. */}
      <PublicOrderHeader businessName={tracking?.businessName} sucursalName={tracking?.sucursalName} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {notFound ? (
          <p className="py-12 text-center text-lg font-semibold text-gray-900">{notFound}</p>
        ) : tracking ? (
          <TrackingDetails tracking={tracking} />
        ) : loadError ? (
          <p role="alert" className="py-12 text-center text-lg font-semibold text-gray-900">
            No pudimos cargar tu pedido. Reintentamos en unos segundos.
          </p>
        ) : (
          <p className="py-12 text-center text-gray-600">Cargando tu pedido…</p>
        )}
      </main>
    </div>
  );
}

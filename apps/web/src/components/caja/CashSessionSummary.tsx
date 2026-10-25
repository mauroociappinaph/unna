import { formatMoney, type CashSession } from '@/lib/api-types';
import { formatDateTime } from '@/components/pos/pos-format';

export const MOVEMENT_TYPE_LABELS = { in: 'Ingreso', out: 'Retiro' } as const;

export function CashSessionSummary({ session }: { session: CashSession }) {
  return (
    <section aria-label="Caja abierta" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Caja abierta</h2>
        <p className="text-sm text-gray-600">Desde el {formatDateTime(session.openedAt)}</p>
      </div>
      <div className="flex justify-between text-gray-900">
        <span>Fondo inicial</span>
        <span className="font-semibold">{formatMoney(session.openingAmount)}</span>
      </div>
      <section aria-label="Movimientos" className="space-y-2">
        <h3 className="font-semibold text-gray-900">Movimientos</h3>
        {session.movements.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no registraste ingresos ni retiros.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {session.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="font-medium text-gray-900">{m.reason}</p>
                  <p className="text-gray-500">
                    <span>{MOVEMENT_TYPE_LABELS[m.type]}</span> · {formatDateTime(m.createdAt)}
                  </p>
                </div>
                <span className={m.type === 'out' ? 'text-red-700' : 'text-unna-green-dark'}>{formatMoney(m.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

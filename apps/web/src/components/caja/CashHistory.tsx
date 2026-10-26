import { Button } from '@/components/ui/Button';
import { formatMoney, type CashSession } from '@/lib/api-types';
import { formatDateTime } from '@/components/pos/pos-format';

interface CashHistoryProps {
  sessions: CashSession[];
  busy: boolean;
  /** There is an older page of sessions to load. */
  hasMore: boolean;
  onSelect: (session: CashSession) => void;
  onLoadMore: () => void;
}

const totalDifference = (session: CashSession) => Object.values(session.difference ?? {}).reduce((total, n) => total + n, 0);

/** Closed sessions of the sucursal, newest first, one page at a time (S17). */
export function CashHistory({ sessions, busy, hasMore, onSelect, onLoadMore }: CashHistoryProps) {
  const closed = sessions
    .filter((s) => s.status === 'closed')
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  return (
    <section aria-label="Historial de cajas" className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Historial de cajas</h2>
      {closed.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no cerraste ninguna caja en esta sucursal.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {closed.map((s) => {
            const difference = totalDifference(s);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(s.openedAt)}
                    {s.closedAt && ` → ${formatDateTime(s.closedAt)}`}
                  </p>
                  <p className="text-gray-500">
                    Fondo {formatMoney(s.openingAmount)} · Diferencia{' '}
                    <span className={difference !== 0 ? 'font-semibold text-red-700' : undefined}>{formatMoney(difference)}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  aria-label={`Ver detalle de la caja del ${formatDateTime(s.openedAt)}`}
                  onClick={() => onSelect(s)}
                >
                  Ver detalle
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <Button variant="outline" size="sm" disabled={busy} onClick={onLoadMore}>
          Ver más
        </Button>
      )}
    </section>
  );
}

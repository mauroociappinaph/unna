import { formatMoney, PAYMENT_METHODS, type CashSession } from '@/lib/api-types';
import { formatDateTime, PAYMENT_METHOD_LABELS } from '@/components/pos/pos-format';

const sum = (amounts: Record<string, number> | undefined) => Object.values(amounts ?? {}).reduce((total, n) => total + n, 0);

function DifferenceCell({ cents }: { cents: number }) {
  if (cents === 0) return <td className="py-2 text-right">{formatMoney(0)}</td>;
  return (
    <td className="py-2 text-right font-semibold text-red-700">
      <span>{formatMoney(cents)}</span>{' '}
      <span className="text-xs uppercase">{cents < 0 ? 'Faltante' : 'Sobrante'}</span>
    </td>
  );
}

/** Expected vs declared vs difference per payment method of a closed session. */
export function CashClosingResult({ session }: { session: CashSession }) {
  const { expected, declared, difference } = session;
  if (!expected || !declared || !difference) return null;

  return (
    <section aria-label="Arqueo de caja" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Arqueo de caja</h2>
        <p className="text-sm text-gray-600">
          {formatDateTime(session.openedAt)}
          {session.closedAt && ` → ${formatDateTime(session.closedAt)}`}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-2 font-medium">Medio de pago</th>
            <th className="py-2 font-medium text-right">Esperado</th>
            <th className="py-2 font-medium text-right">Declarado</th>
            <th className="py-2 font-medium text-right">Diferencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-900">
          {PAYMENT_METHODS.map((method) => (
            <tr key={method} className={difference[method] !== 0 ? 'bg-red-50' : undefined}>
              <td className="py-2">{PAYMENT_METHOD_LABELS[method]}</td>
              <td className="py-2 text-right">{formatMoney(expected[method])}</td>
              <td className="py-2 text-right">{formatMoney(declared[method])}</td>
              <DifferenceCell cents={difference[method]} />
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">{formatMoney(sum(expected))}</td>
            <td className="py-2 text-right">{formatMoney(sum(declared))}</td>
            <DifferenceCell cents={sum(difference)} />
          </tr>
        </tbody>
      </table>
      {session.notes && <p className="text-sm text-gray-600">Notas: {session.notes}</p>}
    </section>
  );
}

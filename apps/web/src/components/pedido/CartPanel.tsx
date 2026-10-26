import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatMoney } from '@/lib/api-types';
import { MAX_LINE_QUANTITY, type CartLine } from './useCart';

export const MAX_CUSTOMER_NAME = 40;

interface CartPanelProps {
  lines: CartLine[];
  total: number;
  customerName: string;
  nameError: string | null;
  error: string | null;
  submitting: boolean;
  onChangeQuantity: (key: string, delta: number) => void;
  onChangeName: (name: string) => void;
  onPay: () => void;
}

const stepperClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-unna-green';

/** Cart, customer name and the Mercado Pago button of the public order page. */
export function CartPanel(props: CartPanelProps) {
  const { lines, total, customerName, nameError, error, submitting, onChangeQuantity, onChangeName, onPay } = props;

  return (
    <section id="tu-pedido" aria-labelledby="tu-pedido-title" className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4">
      <h2 id="tu-pedido-title" className="text-lg font-bold text-gray-900">Tu pedido</h2>
      {lines.length === 0 ? (
        <p className="text-sm text-gray-600">Todavía no agregaste productos.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{line.name}</p>
                {line.optionsLabel && <p className="text-sm text-gray-600">{line.optionsLabel}</p>}
                <p className="text-sm text-gray-900 tabular-nums">{formatMoney(line.unitPrice * line.quantity)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Quitar uno de ${line.name}`} className={stepperClass} onClick={() => onChangeQuantity(line.key, -1)}>
                  −
                </button>
                <span className="w-6 text-center font-semibold tabular-nums">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={`Sumar uno de ${line.name}`}
                  className={stepperClass}
                  disabled={line.quantity >= MAX_LINE_QUANTITY}
                  onClick={() => onChangeQuantity(line.key, 1)}
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-lg font-bold text-gray-900">
        <span>Total</span>
        <span data-testid="cart-total" className="tabular-nums">{formatMoney(total)}</span>
      </div>
      <Input
        id="pedido-customer-name"
        label="Tu nombre"
        autoComplete="given-name"
        maxLength={MAX_CUSTOMER_NAME}
        value={customerName}
        error={nameError ?? undefined}
        helperText="Con este nombre te llamamos cuando esté listo."
        onChange={(event) => onChangeName(event.target.value)}
      />
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}
      <Button className="w-full" size="lg" disabled={lines.length === 0} loading={submitting} onClick={onPay}>
        Pagar con Mercado Pago
      </Button>
      <p className="text-center text-xs text-gray-600">Pagás online y el pedido entra a la barra apenas se aprueba el pago.</p>
    </section>
  );
}

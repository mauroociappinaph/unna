'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatMoney, PAYMENT_METHODS, type Payment, type PaymentMethod } from '@/lib/api-types';
import { PAYMENT_METHOD_LABELS } from './pos-format';
import { centsToInput, parsePesos } from '@/lib/money';

interface PaymentPanelProps {
  payments: Payment[];
  remaining: number;
  busy: boolean;
  onPay: (amount: number, method: PaymentMethod) => void;
  onInvalidAmount: (message: string) => void;
}

export function PaymentPanel({
  payments, remaining, busy, onPay, onInvalidAmount,
}: PaymentPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState(centsToInput(remaining));

  useEffect(() => {
    setAmount(centsToInput(remaining));
  }, [remaining]);

  const handlePay = () => {
    const cents = parsePesos(amount);
    if (cents === null || cents <= 0) {
      onInvalidAmount('Ingresá un monto válido en pesos.');
      return;
    }
    onPay(cents, method);
  };

  return (
    <div className="space-y-4">
      <section aria-label="Pagos" className="space-y-2">
        {payments.length > 0 && (
          <ul className="text-sm text-gray-600 space-y-1">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                <span>{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between font-semibold text-gray-900">
          <span>Restante</span>
          <span>{formatMoney(remaining)}</span>
        </div>
      </section>

      {remaining > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
          <Select
            id="pos-payment-method"
            label="Medio de pago"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
          />
          <Input
            id="pos-payment-amount"
            label="Monto ($)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button disabled={busy} onClick={handlePay}>Registrar pago</Button>
        </div>
      )}
    </div>
  );
}

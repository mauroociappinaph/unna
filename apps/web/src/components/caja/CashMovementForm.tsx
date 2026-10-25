'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CASH_MOVEMENT_TYPES, type CashMovementInput, type CashMovementType } from '@/lib/api-types';
import { parsePesos } from '@/lib/money';
import { MOVEMENT_TYPE_LABELS } from './CashSessionSummary';

interface CashMovementFormProps {
  busy: boolean;
  /** Resolves true when the movement was saved, so the form clears. */
  onSubmit: (movement: CashMovementInput) => Promise<boolean>;
  onInvalid: (message: string) => void;
}

export function CashMovementForm({ busy, onSubmit, onInvalid }: CashMovementFormProps) {
  const [type, setType] = useState<CashMovementType>('in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parsePesos(amount);
    if (cents === null || cents <= 0) {
      onInvalid('Ingresá un monto válido en pesos.');
      return;
    }
    if (!reason.trim()) {
      onInvalid('Indicá el motivo del movimiento.');
      return;
    }
    if (await onSubmit({ type, amount: cents, reason: reason.trim() })) {
      setAmount('');
      setReason('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Registrar movimiento">
      <h3 className="font-semibold text-gray-900">Ingreso o retiro de efectivo</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          id="caja-movement-type"
          label="Tipo de movimiento"
          value={type}
          onChange={(e) => setType(e.target.value as CashMovementType)}
          options={CASH_MOVEMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_TYPE_LABELS[t] }))}
        />
        <Input
          id="caja-movement-amount"
          label="Monto del movimiento ($)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <Input
        id="caja-movement-reason"
        label="Motivo"
        placeholder="Ej: Pago a proveedor"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={busy}>Registrar movimiento</Button>
    </form>
  );
}

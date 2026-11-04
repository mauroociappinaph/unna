'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PAYMENT_METHODS, type CashAmounts, type CloseCashSessionInput, type PaymentMethod } from '@/lib/api-types';
import { parsePesos } from '@/lib/money';
import { PAYMENT_METHOD_LABELS } from '@/components/pos/pos-format';

interface CloseCashFormProps {
  busy: boolean;
  onClose: (input: CloseCashSessionInput) => void;
  onInvalid: (message: string) => void;
}

const EMPTY = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, ''])) as Record<PaymentMethod, string>;

export function CloseCashForm({ busy, onClose, onInvalid }: CloseCashFormProps) {
  const [counted, setCounted] = useState(EMPTY);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const declared = {} as CashAmounts;
    for (const method of PAYMENT_METHODS) {
      // An empty field means nothing was counted for that method.
      const cents = counted[method].trim() === '' ? 0 : parsePesos(counted[method]);
      if (cents === null || cents < 0) {
        onInvalid('Ingresá montos válidos en pesos.');
        return;
      }
      declared[method] = cents;
    }
    onClose({ declared, ...(notes.trim() ? { notes: notes.trim() } : {}) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Cerrar caja">
      <div>
        <h3 className="font-semibold text-gray-900">Cerrar caja</h3>
        <p className="text-sm text-gray-600">Ingresá lo que contaste por cada medio de pago; lo comparamos con lo esperado.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PAYMENT_METHODS.map((method) => (
          <Input
            key={method}
            id={`caja-declared-${method}`}
            label={`${PAYMENT_METHOD_LABELS[method]} ($)`}
            inputMode="decimal"
            placeholder="0"
            value={counted[method]}
            onChange={(e) => setCounted({ ...counted, [method]: e.target.value })}
          />
        ))}
      </div>
      <div>
        <label htmlFor="caja-close-notes" className="label-field">Notas del cierre</label>
        <textarea
          id="caja-close-notes"
          className="input-field"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy}>Cerrar caja</Button>
    </form>
  );
}

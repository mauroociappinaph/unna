'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { parsePesos } from '@/lib/money';

interface OpenCashFormProps {
  busy: boolean;
  onOpen: (openingAmount: number) => void;
  onInvalidAmount: (message: string) => void;
}

export function OpenCashForm({ busy, onOpen, onInvalidAmount }: OpenCashFormProps) {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parsePesos(amount);
    if (cents === null || cents < 0) {
      onInvalidAmount('Ingresá un monto válido en pesos.');
      return;
    }
    onOpen(cents);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Abrir caja">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">La caja está cerrada</h2>
        <p className="text-gray-600">Contá el efectivo con el que arrancás el turno y abrí la caja para empezar a vender.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <Input
          id="caja-opening-amount"
          label="Fondo inicial ($)"
          inputMode="decimal"
          placeholder="Ej: 5.000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button type="submit" disabled={busy}>Abrir caja</Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { IssueReceiptInput, IvaCondition, ReceiptType } from '@/lib/api-types';
import { IVA_CONDITION_LABELS, RECEIPT_CHOICES, RECEIPT_TYPE_LABELS } from './pos-format';

/** Conditions of a customer that receives factura A. */
const A_CUSTOMER_CONDITIONS: IvaCondition[] = ['responsable_inscripto', 'monotributo'];

interface ReceiptIssuerProps {
  /** IVA condition of the business; without one only the ticket is offered. */
  ivaCondition?: IvaCondition;
  busy: boolean;
  onIssue: (input: IssueReceiptInput) => void;
  onInvalid: (message: string) => void;
}

const issueLabel = (type: ReceiptType) => (type === 'ticket' ? 'Emitir ticket' : `Emitir factura ${type}`);

export function ReceiptIssuer({ ivaCondition, busy, onIssue, onInvalid }: ReceiptIssuerProps) {
  const choices = ivaCondition ? RECEIPT_CHOICES[ivaCondition] : RECEIPT_CHOICES.consumidor_final;
  const [type, setType] = useState<ReceiptType>(choices[0]);
  const [taxId, setTaxId] = useState('');
  const [name, setName] = useState('');
  const [condition, setCondition] = useState<IvaCondition | ''>('');

  const handleIssue = () => {
    if (type !== 'A') {
      onIssue({ type });
      return;
    }
    const digits = taxId.replace(/\D/g, '');
    if (digits.length !== 11) {
      onInvalid('La factura A requiere el CUIT del cliente (11 dígitos).');
      return;
    }
    if (!name.trim()) {
      onInvalid('Ingresá la razón social del cliente.');
      return;
    }
    if (!condition) {
      onInvalid('Elegí la condición frente al IVA del cliente.');
      return;
    }
    onIssue({ type, customerName: name.trim(), customerTaxId: digits, customerCondition: condition });
  };

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="label-field">Comprobante</legend>
        <div className="flex flex-wrap gap-4">
          {choices.map((choice) => (
            <label key={choice} className="flex items-center gap-2 text-gray-900">
              <input
                type="radio"
                name="pos-receipt-type"
                value={choice}
                checked={type === choice}
                onChange={() => setType(choice)}
                className="accent-unna-green"
              />
              {RECEIPT_TYPE_LABELS[choice]}
            </label>
          ))}
        </div>
      </fieldset>

      {type === 'B' && <p className="text-sm text-gray-600">A consumidor final.</p>}

      {type === 'A' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="pos-customer-tax-id"
            label="CUIT del cliente"
            inputMode="numeric"
            placeholder="30-71234567-1"
            maxLength={13}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
          <Input
            id="pos-customer-name"
            label="Razón social"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            id="pos-customer-condition"
            label="Condición frente al IVA"
            placeholder="Elegí la condición"
            value={condition}
            onChange={(e) => setCondition(e.target.value as IvaCondition)}
            options={A_CUSTOMER_CONDITIONS.map((c) => ({ value: c, label: IVA_CONDITION_LABELS[c] }))}
          />
        </div>
      )}

      <Button disabled={busy} onClick={handleIssue}>{issueLabel(type)}</Button>
    </div>
  );
}

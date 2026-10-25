'use client';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ORDER_TYPES, type OrderType } from '@/lib/api-types';
import { ORDER_TYPE_LABELS } from './pos-format';

export interface PosSucursal {
  id: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
}

interface PosSetupProps {
  sucursales: PosSucursal[];
  sucursalId: string;
  type: OrderType;
  tableNumber: string;
  disabled: boolean;
  onSucursalChange: (id: string) => void;
  onTypeChange: (type: OrderType) => void;
  onTableNumberChange: (table: string) => void;
}

export function PosSetup({
  sucursales, sucursalId, type, tableNumber, disabled, onSucursalChange, onTypeChange, onTableNumberChange,
}: PosSetupProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Select
        id="pos-sucursal"
        label="Sucursal"
        value={sucursalId}
        disabled={disabled}
        onChange={(e) => onSucursalChange(e.target.value)}
        options={sucursales.map((s) => ({ value: s.id, label: s.name }))}
      />
      <Select
        id="pos-type"
        label="Tipo de pedido"
        value={type}
        disabled={disabled}
        onChange={(e) => onTypeChange(e.target.value as OrderType)}
        options={ORDER_TYPES.map((t) => ({ value: t, label: ORDER_TYPE_LABELS[t] }))}
      />
      {type === 'dine_in' && (
        <Input
          id="pos-table"
          label="Mesa"
          value={tableNumber}
          disabled={disabled}
          maxLength={10}
          onChange={(e) => onTableNumberChange(e.target.value)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import type { CreateOrderInput, Order, OrderLineInput, OrderType } from '@/lib/api-types';

/** Sucursal, type, table and customer the next order is created with. */
export function useOrderSetup() {
  const [sucursalId, setSucursalId] = useState('');
  const [type, setType] = useState<OrderType>('takeaway');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  const newOrderInput = (items: OrderLineInput[]): CreateOrderInput => {
    const table = tableNumber.trim();
    const customer = customerName.trim();
    return {
      sucursalId,
      type,
      ...(type === 'dine_in' && table ? { tableNumber: table } : {}),
      ...(customer ? { customerName: customer } : {}),
      items,
    };
  };

  const restoreFrom = (order: Order) => {
    setSucursalId(order.sucursalId);
    setType(order.type);
    setTableNumber(order.tableNumber ?? '');
    setCustomerName(order.customerName ?? '');
  };

  const reset = (defaultSucursalId: string) => {
    setSucursalId(defaultSucursalId);
    setType('takeaway');
    setTableNumber('');
    setCustomerName('');
  };

  return {
    sucursalId, setSucursalId, type, setType, tableNumber, setTableNumber, customerName, setCustomerName,
    newOrderInput, restoreFrom, reset,
  };
}

export type OrderSetup = ReturnType<typeof useOrderSetup>;

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Order } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import { selectOpenOrders } from './OpenOrders';

/** List of open orders of the sucursal, loaded each time it is shown. */
export function useOpenOrders(businessId: string | undefined, sucursalId: string, setError: (message: string) => void) {
  const [showOpenOrders, setShowOpenOrders] = useState(false);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);

  const toggleOpenOrders = async () => {
    if (showOpenOrders) {
      setShowOpenOrders(false);
      return;
    }
    if (!businessId) return;
    setShowOpenOrders(true);
    setOpenOrdersLoading(true);
    try {
      setOpenOrders(selectOpenOrders(await api.listOrders(businessId, sucursalId ? { sucursalId } : {})));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los pedidos abiertos'));
    } finally {
      setOpenOrdersLoading(false);
    }
  };

  const closeOpenOrders = () => setShowOpenOrders(false);

  return { showOpenOrders, openOrders, openOrdersLoading, toggleOpenOrders, closeOpenOrders };
}

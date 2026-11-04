import { useState } from 'react';
import { api } from '@/lib/api';
import type { OrderSummary } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import { selectOpenOrders } from './OpenOrders';

/** The API returns at most this many orders per page (S17). */
const OPEN_ORDERS_LIMIT = 200;

const startOfToday = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

/** List of open orders of the sucursal created today, loaded each time it is shown. */
export function useOpenOrders(businessId: string | undefined, sucursalId: string, setError: (message: string) => void) {
  const [showOpenOrders, setShowOpenOrders] = useState(false);
  const [openOrders, setOpenOrders] = useState<OrderSummary[]>([]);
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
      const { items } = await api.listOrders(businessId, {
        ...(sucursalId ? { sucursalId } : {}),
        open: true,
        from: startOfToday(),
        limit: OPEN_ORDERS_LIMIT,
      });
      // The API already filters; this keeps the list right if it ever returns more.
      setOpenOrders(selectOpenOrders(items));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los pedidos abiertos'));
    } finally {
      setOpenOrdersLoading(false);
    }
  };

  const closeOpenOrders = () => setShowOpenOrders(false);

  return { showOpenOrders, openOrders, openOrdersLoading, toggleOpenOrders, closeOpenOrders };
}

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Order, OrderAction, OrderLineInput, Product, SelectedModifier } from '@/lib/api-types';
import { toOrderLine } from './pos-format';
import { useCheckout } from './useCheckout';
import type { OrderSetup } from './useOrderSetup';
import type { PosTask } from './usePosTask';

interface Options {
  businessId: string | undefined;
  setup: OrderSetup;
  task: PosTask;
  defaultSucursalId: string;
  closeOpenOrders: () => void;
}

/** Order being sold: its lines, status, checkout and the last order offered to repeat. */
export function useOrderDraft({ businessId, setup, task, defaultSucursalId, closeOpenOrders }: Options) {
  const [order, setOrder] = useState<Order | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  // Last completed order (receipt issued or left for a new one), offered to repeat.
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const checkout = useCheckout({ businessId, order, setOrder, onReceiptIssued: setLastOrder, task });
  const { run } = task;

  const addLine = (line: OrderLineInput) => {
    if (!businessId) return;
    return run(async () => {
      if (order) {
        setOrder(await api.addOrderItem(businessId, order.id, line));
        return;
      }
      setOrder(await api.createOrder(businessId, setup.newOrderInput([line])));
    }, 'No se pudo agregar el producto');
  };

  const selectProduct = (product: Product) => {
    if (product.modifierGroupIds.length > 0) {
      setPendingProduct(product);
      return;
    }
    addLine({ productId: product.id, quantity: 1 });
  };

  const confirmModifiers = (modifiers: SelectedModifier[]) => {
    if (!pendingProduct) return;
    const productId = pendingProduct.id;
    setPendingProduct(null);
    addLine({ productId, quantity: 1, ...(modifiers.length > 0 ? { modifiers } : {}) });
  };

  const removeItem = (itemId: string) => {
    if (!businessId || !order) return;
    run(async () => setOrder(await api.removeOrderItem(businessId, order.id, itemId)), 'No se pudo quitar el producto');
  };

  const applyDiscount = (cents: number) => {
    if (!businessId || !order) return;
    run(async () => setOrder(await api.applyOrderDiscount(businessId, order.id, cents)), 'No se pudo aplicar el descuento');
  };

  const changeStatus = (action: OrderAction, reason?: string) => {
    if (!businessId || !order) return;
    run(async () => setOrder(await api.changeOrderStatus(businessId, order.id, action, reason)), 'No se pudo cambiar el estado');
  };

  /** The listed order has no items: the detail is fetched again. */
  const resume = (selected: Pick<Order, 'id'>) => {
    if (!businessId) return;
    run(async () => {
      const [fresh, orderPayments] = await Promise.all([
        api.getOrder(businessId, selected.id),
        api.listPayments(businessId, selected.id),
      ]);
      const completed = orderPayments.filter((p) => p.status === 'completed');
      const paid = completed.reduce((sum, p) => sum + p.amount, 0);
      setOrder(fresh);
      checkout.restore(completed, completed.length > 0 ? Math.max(0, fresh.totalAmount.amount - paid) : null);
      setup.restoreFrom(fresh);
      closeOpenOrders();
    }, 'No se pudo abrir el pedido');
  };

  const clearOrder = () => {
    setOrder(null);
    checkout.reset();
    setPendingProduct(null);
    closeOpenOrders();
  };

  const newOrder = () => {
    if (order && order.items.length > 0 && order.status !== 'cancelled') setLastOrder(order);
    clearOrder();
    task.setError(null);
    setup.reset(defaultSucursalId);
  };

  // Same lines as a new order with the current setup; the server applies the open caja gate again.
  const repeatLastOrder = () => {
    if (!businessId || !lastOrder) return;
    const lines = lastOrder.items.map(toOrderLine);
    run(async () => {
      const created = await api.createOrder(businessId, setup.newOrderInput(lines));
      clearOrder();
      setOrder(created);
    }, 'No se pudo repetir el último pedido');
  };

  // Offered only when nothing is in progress: no order yet or the current one already has its receipt.
  const canRepeat = !!lastOrder && (!order || !!checkout.receipt);

  return {
    order, pendingProduct, canRepeat, checkout,
    selectProduct, confirmModifiers, cancelModifiers: () => setPendingProduct(null),
    removeItem, applyDiscount, changeStatus, resume, newOrder, repeatLastOrder,
  };
}

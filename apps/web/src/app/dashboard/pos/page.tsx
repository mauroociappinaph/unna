'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import type {
  Category, ModifierGroup, Order, OrderAction, OrderLineInput, OrderType, Payment, PaymentMethod, Product, Receipt,
  SelectedModifier,
} from '@/lib/api-types';
import { ModifierDialog } from '@/components/pos/ModifierDialog';
import { OpenOrders, selectOpenOrders } from '@/components/pos/OpenOrders';
import { OrderStatusActions } from '@/components/pos/OrderStatusActions';
import { OrderSummary } from '@/components/pos/OrderSummary';
import { PaymentPanel } from '@/components/pos/PaymentPanel';
import { PosSetup, type PosSucursal } from '@/components/pos/PosSetup';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ReceiptView } from '@/components/pos/ReceiptView';
import { CLOSED_STATUSES } from '@/components/pos/pos-format';
import { apiErrorMessage } from '@/lib/api-errors';

interface Business {
  id: string;
  businessName: string;
  sucursales: PosSucursal[];
}

const mainSucursalId = (sucursales: PosSucursal[]) => (sucursales.find((s) => s.isMain) ?? sucursales[0])?.id ?? '';

export default function PosPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [sucursales, setSucursales] = useState<PosSucursal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sucursalId, setSucursalId] = useState('');
  const [type, setType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState('');

  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  // Balance reported by the server after a payment; null while nothing was paid.
  const [paidRemaining, setPaidRemaining] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const [showOpenOrders, setShowOpenOrders] = useState(false);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      if (!localStorage.getItem('auth_token')) {
        router.push('/login');
        return;
      }

      const businesses: Business[] = await api.getBusinesses();
      if (businesses.length === 0) {
        setError('No se encontró ningún negocio asociado');
        return;
      }

      const current = businesses[0];
      const active = (current.sucursales || []).filter((s) => s.isActive !== false);
      const [categoryList, productList, groupList] = await Promise.all([
        api.listCategories(current.id),
        api.listProducts(current.id, { status: 'active' }),
        api.listModifierGroups(current.id),
      ]);
      setBusiness(current);
      setSucursales(active);
      setSucursalId(mainSucursalId(active));
      setCategories(categoryList);
      setProducts(productList);
      setModifierGroups(groupList);
    } catch (err) {
      setError(apiErrorMessage(err, 'Error al cargar el punto de venta'));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const run = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const addLine = (line: OrderLineInput) => {
    if (!business) return;
    return run(async () => {
      if (order) {
        setOrder(await api.addOrderItem(business.id, order.id, line));
        return;
      }
      const table = tableNumber.trim();
      setOrder(await api.createOrder(business.id, {
        sucursalId,
        type,
        ...(type === 'dine_in' && table ? { tableNumber: table } : {}),
        items: [line],
      }));
    }, 'No se pudo agregar el producto');
  };

  const handleSelectProduct = (product: Product) => {
    if (product.modifierGroupIds.length > 0) {
      setPendingProduct(product);
      return;
    }
    addLine({ productId: product.id, quantity: 1 });
  };

  const handleConfirmModifiers = (modifiers: SelectedModifier[]) => {
    if (!pendingProduct) return;
    const productId = pendingProduct.id;
    setPendingProduct(null);
    addLine({ productId, quantity: 1, ...(modifiers.length > 0 ? { modifiers } : {}) });
  };

  const handleRemoveItem = (itemId: string) => {
    if (!business || !order) return;
    run(async () => setOrder(await api.removeOrderItem(business.id, order.id, itemId)), 'No se pudo quitar el producto');
  };

  const handleDiscount = (cents: number) => {
    if (!business || !order) return;
    run(async () => setOrder(await api.applyOrderDiscount(business.id, order.id, cents)), 'No se pudo aplicar el descuento');
  };

  const handleStatus = (action: OrderAction, reason?: string) => {
    if (!business || !order) return;
    run(async () => setOrder(await api.changeOrderStatus(business.id, order.id, action, reason)), 'No se pudo cambiar el estado');
  };

  const handlePay = (amount: number, method: PaymentMethod) => {
    if (!business || !order) return;
    run(async () => {
      const result = await api.registerPayment(business.id, order.id, { amount, method });
      setOrder(result.order);
      setPayments(result.payments);
      setPaidRemaining(result.remaining);
    }, 'No se pudo registrar el pago');
  };

  const handleIssueReceipt = () => {
    if (!business || !order) return;
    run(async () => setReceipt(await api.issueReceipt(business.id, order.id, { type: 'ticket' })), 'No se pudo emitir el ticket');
  };

  const toggleOpenOrders = async () => {
    if (showOpenOrders) {
      setShowOpenOrders(false);
      return;
    }
    if (!business) return;
    setShowOpenOrders(true);
    setOpenOrdersLoading(true);
    try {
      setOpenOrders(selectOpenOrders(await api.listOrders(business.id, sucursalId ? { sucursalId } : {})));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los pedidos abiertos'));
    } finally {
      setOpenOrdersLoading(false);
    }
  };

  const handleResume = (selected: Order) => {
    if (!business) return;
    run(async () => {
      const [fresh, orderPayments] = await Promise.all([
        api.getOrder(business.id, selected.id),
        api.listPayments(business.id, selected.id),
      ]);
      const completed = orderPayments.filter((p) => p.status === 'completed');
      const paid = completed.reduce((sum, p) => sum + p.amount, 0);
      setOrder(fresh);
      setPayments(completed);
      setPaidRemaining(completed.length > 0 ? Math.max(0, fresh.totalAmount.amount - paid) : null);
      setReceipt(null);
      setShowPayment(completed.length > 0);
      setSucursalId(fresh.sucursalId);
      setType(fresh.type);
      setTableNumber(fresh.tableNumber ?? '');
      setShowOpenOrders(false);
    }, 'No se pudo abrir el pedido');
  };

  const handleNewOrder = () => {
    setOrder(null);
    setPayments([]);
    setPaidRemaining(null);
    setReceipt(null);
    setPendingProduct(null);
    setShowPayment(false);
    setShowOpenOrders(false);
    setError(null);
    setSucursalId(mainSucursalId(sucursales));
    setType('dine_in');
    setTableNumber('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-unna-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const locked = payments.length > 0 || (!!order && CLOSED_STATUSES.includes(order.status));
  const remaining = order ? paidRemaining ?? order.totalAmount.amount : 0;
  const hasItems = !!order && order.items.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <svg className="w-8 h-8 text-unna-green" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5L25.5 9 16 13.5 6.5 9 16 4.5zM6 10.5l9 4.5 9-4.5v11L16 28.5 6 24v-13.5z" />
              </svg>
              <span className="text-xl font-bold text-gray-900">UNNA</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">← Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Punto de venta</h1>
              <p className="text-gray-600">Cargá pedidos, cobralos y emití el ticket</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={toggleOpenOrders}>Pedidos abiertos</Button>
              <Button onClick={handleNewOrder}>Nuevo pedido</Button>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              {error}
            </div>
          )}

          {showOpenOrders && (
            <OpenOrders orders={openOrders} loading={openOrdersLoading} onResume={handleResume} />
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <PosSetup
              sucursales={sucursales}
              sucursalId={sucursalId}
              type={type}
              tableNumber={tableNumber}
              disabled={!!order}
              onSucursalChange={setSucursalId}
              onTypeChange={setType}
              onTableNumberChange={setTableNumber}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6">
              <ProductGrid
                categories={categories}
                products={products}
                disabled={locked || busy}
                onSelect={handleSelectProduct}
              />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {order ? `Pedido ${order.orderNumber}` : 'Pedido nuevo'}
                </h2>
                {order && <OrderStatusActions key={`status-${order.id}`} order={order} busy={busy} onAction={handleStatus} />}
                <OrderSummary
                  key={`summary-${order?.id ?? 'new'}`}
                  order={order}
                  locked={locked}
                  busy={busy}
                  onRemoveItem={handleRemoveItem}
                  onApplyDiscount={handleDiscount}
                  onInvalidAmount={setError}
                />
                {hasItems && !showPayment && (
                  <Button className="w-full" onClick={() => setShowPayment(true)}>Cobrar</Button>
                )}
              </div>

              {order && showPayment && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Cobro</h2>
                  <PaymentPanel
                    payments={payments}
                    remaining={remaining}
                    busy={busy}
                    canIssueReceipt={payments.length > 0 && !receipt}
                    onPay={handlePay}
                    onIssueReceipt={handleIssueReceipt}
                    onInvalidAmount={setError}
                  />
                  {receipt && <ReceiptView receipt={receipt} />}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {pendingProduct && (
        <ModifierDialog
          product={pendingProduct}
          groups={modifierGroups}
          onConfirm={handleConfirmModifiers}
          onCancel={() => setPendingProduct(null)}
        />
      )}
    </div>
  );
}

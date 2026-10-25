'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import type {
  CashSession, Category, CreateOrderInput, IssueReceiptInput, IvaCondition, ModifierGroup, Order, OrderAction,
  OrderLineInput, OrderType, Payment, PaymentMethod, Product, Receipt, SelectedModifier, TopSeller,
} from '@/lib/api-types';
import { FavoritesStrip, MAX_FAVORITES, selectFavorites } from '@/components/pos/FavoritesStrip';
import { ModifierDialog } from '@/components/pos/ModifierDialog';
import { OpenOrders, selectOpenOrders } from '@/components/pos/OpenOrders';
import { OrderStatusActions } from '@/components/pos/OrderStatusActions';
import { OrderSummary } from '@/components/pos/OrderSummary';
import { PaymentPanel } from '@/components/pos/PaymentPanel';
import { PosSetup, type PosSucursal } from '@/components/pos/PosSetup';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ReceiptIssuer } from '@/components/pos/ReceiptIssuer';
import { ReceiptView } from '@/components/pos/ReceiptView';
import { CLOSED_STATUSES, toOrderLine } from '@/components/pos/pos-format';
import { apiErrorMessage } from '@/lib/api-errors';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';

interface Business {
  id: string;
  businessName: string;
  settings?: { ivaCondition?: IvaCondition };
  sucursales: PosSucursal[];
}

/** Current caja of a sucursal; null session when it is closed. */
interface CashState {
  sucursalId: string;
  session: CashSession | null;
}

const isUnavailable = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 503;

/** Top sellers fill the favorites strip from the paid orders of the last week (S13). */
const TOP_SELLERS_QUERY = { days: 7, limit: MAX_FAVORITES };

const mainSucursalId = (sucursales: PosSucursal[]) => (sucursales.find((s) => s.isMain) ?? sucursales[0])?.id ?? '';

export default function PosPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [sucursales, setSucursales] = useState<PosSucursal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sucursalId, setSucursalId] = useState('');
  const [type, setType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  // Balance reported by the server after a payment; null while nothing was paid.
  const [paidRemaining, setPaidRemaining] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // Receipt request to retry after ARCA answered 503 (the draft stays on the server).
  const [retryReceipt, setRetryReceipt] = useState<IssueReceiptInput | null>(null);
  const [cash, setCash] = useState<CashState | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  // Last completed order (receipt issued or left for a new one), offered to repeat.
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const [showOpenOrders, setShowOpenOrders] = useState(false);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);

  const favorites = useMemo(() => selectFavorites(products, topSellers), [products, topSellers]);

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
      const initialSucursalId = mainSucursalId(active);
      const [categoryList, productList, groupList, session, sellers] = await Promise.all([
        api.listCategories(current.id),
        api.listProducts(current.id, { status: 'active' }),
        api.listModifierGroups(current.id),
        initialSucursalId ? api.getCurrentCashSession(current.id, initialSucursalId) : Promise.resolve(null),
        // Selling does not depend on the ranking: without it the strip shows only the pinned products.
        api.getTopSellers(current.id, TOP_SELLERS_QUERY).catch((): TopSeller[] => []),
      ]);
      setBusiness(current);
      setSucursales(active);
      setSucursalId(initialSucursalId);
      setCash({ sucursalId: initialSucursalId, session });
      setCategories(categoryList);
      setProducts(productList);
      setModifierGroups(groupList);
      setTopSellers(sellers);
    } catch (err) {
      setError(apiErrorMessage(err, 'Error al cargar el punto de venta'));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selling needs the caja of the selected sucursal open; reload it when the sucursal changes.
  useEffect(() => {
    if (!business || !sucursalId || cash?.sucursalId === sucursalId) return;
    let cancelled = false;
    api.getCurrentCashSession(business.id, sucursalId)
      .then((session) => {
        if (!cancelled) setCash({ sucursalId, session });
      })
      .catch((err) => {
        if (cancelled) return;
        setCash({ sucursalId, session: null });
        setError(apiErrorMessage(err, 'No se pudo cargar la caja'));
      });
    return () => {
      cancelled = true;
    };
  }, [business, sucursalId, cash]);

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

  const addLine = (line: OrderLineInput) => {
    if (!business) return;
    return run(async () => {
      if (order) {
        setOrder(await api.addOrderItem(business.id, order.id, line));
        return;
      }
      setOrder(await api.createOrder(business.id, newOrderInput([line])));
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

  const handleIssueReceipt = async (input: IssueReceiptInput) => {
    if (!business || !order) return;
    setBusy(true);
    setError(null);
    setRetryReceipt(null);
    try {
      setReceipt(await api.issueReceipt(business.id, order.id, input));
      setLastOrder(order);
    } catch (err) {
      if (isUnavailable(err)) setRetryReceipt(input);
      else setError(apiErrorMessage(err, 'No se pudo emitir el comprobante'));
    } finally {
      setBusy(false);
    }
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
      setRetryReceipt(null);
      setShowPayment(completed.length > 0);
      setSucursalId(fresh.sucursalId);
      setType(fresh.type);
      setTableNumber(fresh.tableNumber ?? '');
      setCustomerName(fresh.customerName ?? '');
      setShowOpenOrders(false);
    }, 'No se pudo abrir el pedido');
  };

  const clearOrder = () => {
    setOrder(null);
    setPayments([]);
    setPaidRemaining(null);
    setReceipt(null);
    setRetryReceipt(null);
    setPendingProduct(null);
    setShowPayment(false);
    setShowOpenOrders(false);
  };

  const handleNewOrder = () => {
    if (order && order.items.length > 0 && order.status !== 'cancelled') setLastOrder(order);
    clearOrder();
    setError(null);
    setSucursalId(mainSucursalId(sucursales));
    setType('dine_in');
    setTableNumber('');
    setCustomerName('');
  };

  // Same lines as a new order with the current setup; the server applies the open caja gate again.
  const handleRepeatLastOrder = () => {
    if (!business || !lastOrder) return;
    const lines = lastOrder.items.map(toOrderLine);
    run(async () => {
      const created = await api.createOrder(business.id, newOrderInput(lines));
      clearOrder();
      setOrder(created);
    }, 'No se pudo repetir el último pedido');
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
  // While the caja of the sucursal is loading nothing can be sold either, but there is no banner yet.
  const cashKnown = !!cash && cash.sucursalId === sucursalId;
  const cashOpen = cashKnown && !!cash.session;
  const canIssueReceipt = payments.length > 0 && remaining === 0 && !receipt;
  // Offered only when nothing is in progress: no order yet or the current one already has its receipt.
  const canRepeat = !!lastOrder && (!order || !!receipt);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <UnnaSymbol className="w-8 h-8 text-unna-green" />
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
              <p className="text-gray-600">Cargá pedidos, cobralos y emití el comprobante</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={toggleOpenOrders}>Pedidos abiertos</Button>
              {canRepeat && (
                <Button variant="secondary" disabled={busy || !cashOpen} onClick={handleRepeatLastOrder}>
                  Repetir último pedido
                </Button>
              )}
              <Button onClick={handleNewOrder}>Nuevo pedido</Button>
            </div>
          </div>

          {cashKnown && !cashOpen && (
            <div
              role="status"
              aria-label="Caja cerrada"
              className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="font-semibold text-amber-900">Abrí la caja para empezar a vender</p>
              <Link href="/dashboard/caja" className="font-semibold text-unna-green-dark underline">
                Ir a la caja
              </Link>
            </div>
          )}

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
              customerName={customerName}
              disabled={!!order}
              onSucursalChange={setSucursalId}
              onTypeChange={setType}
              onTableNumberChange={setTableNumber}
              onCustomerNameChange={setCustomerName}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
              <FavoritesStrip favorites={favorites} disabled={locked || busy || !cashOpen} onSelect={handleSelectProduct} />
              <ProductGrid
                categories={categories}
                products={products}
                disabled={locked || busy || !cashOpen}
                shortcutsEnabled={!pendingProduct}
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
                  <Button className="w-full" disabled={!cashOpen} onClick={() => setShowPayment(true)}>Cobrar</Button>
                )}
              </div>

              {order && showPayment && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Cobro</h2>
                  <PaymentPanel
                    payments={payments}
                    remaining={remaining}
                    busy={busy || !cashOpen}
                    onPay={handlePay}
                    onInvalidAmount={setError}
                  />
                  {canIssueReceipt && (
                    <ReceiptIssuer
                      key={`receipt-${order.id}`}
                      ivaCondition={business?.settings?.ivaCondition}
                      busy={busy}
                      onIssue={handleIssueReceipt}
                      onInvalid={setError}
                    />
                  )}
                  {canIssueReceipt && retryReceipt && (
                    <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <p className="text-amber-900">ARCA no está disponible; el comprobante quedó en borrador</p>
                      <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleIssueReceipt(retryReceipt)}>
                        Reintentar
                      </Button>
                    </div>
                  )}
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

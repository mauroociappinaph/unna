'use client';

import { CashClosedBanner } from '@/components/pos/CashClosedBanner';
import { CheckoutPanel } from '@/components/pos/CheckoutPanel';
import { FavoritesStrip } from '@/components/pos/FavoritesStrip';
import { ModifierDialog } from '@/components/pos/ModifierDialog';
import { OpenOrders } from '@/components/pos/OpenOrders';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { PosHeader } from '@/components/pos/PosHeader';
import { PosSetup } from '@/components/pos/PosSetup';
import { PosToolbar } from '@/components/pos/PosToolbar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CLOSED_STATUSES } from '@/components/pos/pos-format';
import { useOpenOrders } from '@/components/pos/useOpenOrders';
import { useOrderDraft } from '@/components/pos/useOrderDraft';
import { useOrderSetup } from '@/components/pos/useOrderSetup';
import { mainSucursalId, usePosBusiness } from '@/components/pos/usePosBusiness';
import { usePosTask } from '@/components/pos/usePosTask';

export default function PosPage() {
  const task = usePosTask();
  const { error, setError, busy } = task;
  const setup = useOrderSetup();
  const { business, sucursales, categories, products, modifierGroups, favorites, isLoading, cashKnown, cashOpen } =
    usePosBusiness({ sucursalId: setup.sucursalId, setSucursalId: setup.setSucursalId, setError });
  const openOrders = useOpenOrders(business?.id, setup.sucursalId, setError);
  const draft = useOrderDraft({
    businessId: business?.id,
    setup,
    task,
    defaultSucursalId: mainSucursalId(sucursales),
    closeOpenOrders: openOrders.closeOpenOrders,
  });
  const { order, pendingProduct, checkout } = draft;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-unna-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const locked = checkout.payments.length > 0 || (!!order && CLOSED_STATUSES.includes(order.status));
  const hasItems = !!order && order.items.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <PosHeader />

      <main className="container-custom py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <PosToolbar
            canRepeat={draft.canRepeat}
            repeatDisabled={busy || !cashOpen}
            onToggleOpenOrders={openOrders.toggleOpenOrders}
            onRepeatLastOrder={draft.repeatLastOrder}
            onNewOrder={draft.newOrder}
          />

          {cashKnown && !cashOpen && <CashClosedBanner />}

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              {error}
            </div>
          )}

          {openOrders.showOpenOrders && (
            <OpenOrders orders={openOrders.openOrders} loading={openOrders.openOrdersLoading} onResume={draft.resume} />
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <PosSetup
              sucursales={sucursales}
              sucursalId={setup.sucursalId}
              type={setup.type}
              tableNumber={setup.tableNumber}
              customerName={setup.customerName}
              disabled={!!order}
              onSucursalChange={setup.setSucursalId}
              onTypeChange={setup.setType}
              onTableNumberChange={setup.setTableNumber}
              onCustomerNameChange={setup.setCustomerName}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
              <FavoritesStrip favorites={favorites} disabled={locked || busy || !cashOpen} onSelect={draft.selectProduct} />
              <ProductGrid
                categories={categories}
                products={products}
                disabled={locked || busy || !cashOpen}
                shortcutsEnabled={!pendingProduct}
                onSelect={draft.selectProduct}
              />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <OrderPanel
                order={order}
                locked={locked}
                busy={busy}
                canCharge={hasItems && !checkout.showPayment}
                chargeDisabled={!cashOpen}
                onStatus={draft.changeStatus}
                onRemoveItem={draft.removeItem}
                onApplyDiscount={draft.applyDiscount}
                onInvalidAmount={setError}
                onCharge={checkout.openPayment}
              />

              {order && checkout.showPayment && (
                <CheckoutPanel
                  orderId={order.id}
                  payments={checkout.payments}
                  remaining={checkout.remaining}
                  receipt={checkout.receipt}
                  retryReceipt={checkout.retryReceipt}
                  ivaCondition={business?.settings?.ivaCondition}
                  busy={busy}
                  cashOpen={cashOpen}
                  onPay={checkout.pay}
                  onIssueReceipt={checkout.issueReceipt}
                  onInvalid={setError}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {pendingProduct && (
        <ModifierDialog
          product={pendingProduct}
          groups={modifierGroups}
          onConfirm={draft.confirmModifiers}
          onCancel={draft.cancelModifiers}
        />
      )}
    </div>
  );
}

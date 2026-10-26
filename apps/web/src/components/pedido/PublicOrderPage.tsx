'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/api-types';
import { redirectTo } from '@/lib/navigation';
import { createCheckout, getPublicMenu, PublicOrderError, type PublicMenu, type PublicProduct } from '@/lib/public-order-api';
import { CartPanel } from './CartPanel';
import { MenuList } from './MenuList';
import { ProductSheet } from './ProductSheet';
import { PublicOrderHeader } from './PublicOrderHeader';
import { MAX_LINES, useCart } from './useCart';

const errorText = (err: unknown) => (err instanceof PublicOrderError ? err.message : 'Algo salió mal. Probá de nuevo en un momento.');

/** Public order page of a sucursal (S20): menu, cart, name and online payment with Mercado Pago. */
export function PublicOrderPage({ slug }: { slug: string }) {
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetProduct, setSheetProduct] = useState<PublicProduct | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cart = useCart();

  useEffect(() => {
    let cancelled = false;
    getPublicMenu(slug)
      .then((loaded) => !cancelled && setMenu(loaded))
      .catch((err) => !cancelled && setLoadError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Back from Mercado Pago, the browser may restore this page as it was left: "submitting". Let the customer pay again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSubmitting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleAdd = (product: PublicProduct) => {
    if (product.modifierGroups.length > 0) setSheetProduct(product);
    else cart.add(product, []);
  };

  const handlePay = async () => {
    const name = customerName.trim();
    if (!name) {
      setNameError('Ingresá tu nombre para retirar el pedido');
      return;
    }
    if (cart.lines.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { checkoutUrl } = await createCheckout(slug, { customerName: name, items: cart.checkoutItems() });
      // Stays "submitting" while the browser leaves for Mercado Pago, so it cannot be paid twice.
      redirectTo(checkoutUrl);
    } catch (err) {
      setError(errorText(err));
      setSubmitting(false);
    }
  };

  if (loadError || !menu) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicOrderHeader />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className={loadError ? 'text-lg font-semibold text-gray-900' : 'text-gray-600'}>{loadError ?? 'Cargando el menú…'}</p>
        </main>
      </div>
    );
  }

  const canAdd = menu.accepting && !cart.full;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <PublicOrderHeader businessName={menu.businessName} sucursalName={menu.sucursalName} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {menu.accepting ? (
          <p className="text-sm text-gray-600">Pedí y pagá desde el celular. Lo retirás en unos {menu.estimatedMinutes} min.</p>
        ) : (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">Ahora no estamos tomando pedidos anticipados</p>
            {menu.reason && <p className="mt-1">{menu.reason}</p>}
          </div>
        )}
        {cart.full && <p className="text-sm text-amber-800">Llegaste al máximo de {MAX_LINES} productos distintos por pedido.</p>}

        <MenuList menu={menu} onAdd={canAdd ? handleAdd : null} />

        {menu.accepting && (
          <CartPanel
            lines={cart.lines}
            total={cart.total}
            customerName={customerName}
            nameError={nameError}
            error={error}
            submitting={submitting}
            onChangeQuantity={cart.changeQuantity}
            onChangeName={(value) => {
              setCustomerName(value);
              setNameError(null);
            }}
            onPay={handlePay}
          />
        )}
      </main>

      {menu.accepting && cart.lines.length > 0 && (
        <a
          href="#tu-pedido"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-2xl items-center justify-between rounded-xl bg-unna-green-dark px-5 py-4 font-semibold text-white shadow-lg"
        >
          <span>Ver mi pedido</span>
          <span className="tabular-nums">{formatMoney(cart.total)}</span>
        </a>
      )}

      {sheetProduct && (
        <ProductSheet
          product={sheetProduct}
          onCancel={() => setSheetProduct(null)}
          onConfirm={(modifiers) => {
            cart.add(sheetProduct, modifiers);
            setSheetProduct(null);
          }}
        />
      )}
    </div>
  );
}

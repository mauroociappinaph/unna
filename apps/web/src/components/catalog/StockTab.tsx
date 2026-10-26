'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { STOCK_OUT_TYPES, type Product, type StockLevel, type StockMovement, type StockOutType } from '@/lib/api-types';
import { ErrorBanner } from './ErrorBanner';
import { STOCK_MOVEMENT_LABELS, STOCK_OUT_TYPE_LABELS } from './catalog-utils';
import { apiErrorMessage } from '@/lib/api-errors';

/** Movements per page; "Ver más" loads the next older page (S17). */
const RECENT_MOVEMENTS = 10;

type PanelMode = 'in' | 'out' | 'movements';

interface Panel {
  productId: string;
  mode: PanelMode;
}

const PANEL_TITLES: Record<PanelMode, string> = {
  in: 'Ingresar stock',
  out: 'Egresar stock',
  movements: 'Movimientos recientes',
};

const parseQuantity = (value: string) => {
  const quantity = Number(value.trim().replace(',', '.'));
  return value.trim() && quantity > 0 ? quantity : NaN;
};

interface StockChangeFormProps {
  mode: 'in' | 'out';
  onSubmit: (data: { quantity: number; reason: string; type?: StockOutType }) => Promise<void>;
  onCancel: () => void;
}

function StockChangeForm({ mode, onSubmit, onCancel }: StockChangeFormProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<StockOutType>('out');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = parseQuantity(quantity);
    if (Number.isNaN(amount)) return setError('Ingresá una cantidad mayor a 0');
    if (!reason.trim()) return setError('Ingresá el motivo');

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ quantity: amount, reason: reason.trim(), ...(mode === 'out' ? { type } : {}) });
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo actualizar el stock'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div className="grid gap-4 md:grid-cols-3">
        <Input id="stock-quantity" label="Cantidad" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input id="stock-reason" label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
        {mode === 'out' && (
          <Select
            id="stock-out-type"
            label="Tipo de egreso"
            value={type}
            onChange={(e) => setType(e.target.value as StockOutType)}
            options={STOCK_OUT_TYPES.map((value) => ({ value, label: STOCK_OUT_TYPE_LABELS[value] }))}
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>Confirmar</Button>
      </div>
    </form>
  );
}

function MovementsList({ businessId, productId }: { businessId: string; productId: string }) {
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listStockMovements(businessId, { productId, limit: RECENT_MOVEMENTS })
      .then((page) => {
        if (!active) return;
        setMovements(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => active && setError(apiErrorMessage(err, 'No se pudieron cargar los movimientos')));
    return () => {
      active = false;
    };
  }, [businessId, productId]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.listStockMovements(businessId, { productId, limit: RECENT_MOVEMENTS, cursor: nextCursor });
      setMovements((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar más movimientos'));
    } finally {
      setLoadingMore(false);
    }
  };

  if (error && !movements) return <ErrorBanner message={error} />;
  if (!movements) return <p className="text-gray-500">Cargando movimientos…</p>;
  if (movements.length === 0) return <p className="text-gray-500">Este producto todavía no tiene movimientos.</p>;

  return (
    <div className="space-y-3">
      <ErrorBanner message={error} />
      <table className="w-full text-sm">
        <thead className="text-left text-gray-600">
          <tr>
            <th className="py-2">Fecha</th>
            <th className="py-2">Tipo</th>
            <th className="py-2">Cantidad</th>
            <th className="py-2">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="border-t border-gray-100">
              <td className="py-2">{new Date(movement.createdAt).toLocaleString('es-AR')}</td>
              <td className="py-2">{STOCK_MOVEMENT_LABELS[movement.type] ?? movement.type}</td>
              <td className="py-2">{movement.type === 'in' ? `+${movement.quantity}` : `-${movement.quantity}`}</td>
              <td className="py-2">{movement.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor && (
        <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
          Ver más
        </Button>
      )}
    </div>
  );
}

export function StockTab({ businessId }: { businessId: string }) {
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [initProductId, setInitProductId] = useState('');
  const [initQuantity, setInitQuantity] = useState('');
  const [initMinThreshold, setInitMinThreshold] = useState('');
  const [initializing, setInitializing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [levelList, productList] = await Promise.all([api.listStockLevels(businessId), api.listProducts(businessId)]);
      setLevels(levelList);
      setProducts(productList);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cargar el stock'));
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const productNames = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const productsWithoutLevel = useMemo(() => {
    const tracked = new Set(levels.map((level) => level.productId));
    return products.filter((product) => !tracked.has(product.id));
  }, [levels, products]);

  const handleStockChange = async (data: { quantity: number; reason: string; type?: StockOutType }) => {
    if (!panel) return;
    if (panel.mode === 'in') {
      await api.addStock(businessId, panel.productId, { quantity: data.quantity, reason: data.reason });
    } else {
      await api.removeStock(businessId, panel.productId, data);
    }
    setPanel(null);
    await load();
  };

  const handleInitialize = async (event: FormEvent) => {
    event.preventDefault();
    const initialQuantity = Number(initQuantity.trim().replace(',', '.'));
    const minThreshold = Number(initMinThreshold.trim().replace(',', '.'));
    if (!initProductId) return setError('Elegí el producto a inicializar');
    if (!initQuantity.trim() || Number.isNaN(initialQuantity) || initialQuantity < 0) {
      return setError('Ingresá una cantidad inicial válida');
    }
    if (initMinThreshold.trim() && (Number.isNaN(minThreshold) || minThreshold < 0)) {
      return setError('Ingresá un stock mínimo válido');
    }

    setError(null);
    setInitializing(true);
    try {
      await api.initializeStock(businessId, initProductId, {
        initialQuantity,
        ...(initMinThreshold.trim() ? { minThreshold } : {}),
      });
      setInitProductId('');
      setInitQuantity('');
      setInitMinThreshold('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo inicializar el stock'));
    } finally {
      setInitializing(false);
    }
  };

  if (isLoading) return <p className="text-gray-500">Cargando stock…</p>;

  return (
    <section className="space-y-6">
      <ErrorBanner message={error} />

      {levels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-600">
          Todavía no controlás el stock de ningún producto. Inicializalo abajo.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Disponible</th>
                <th className="px-4 py-3">Reservado</th>
                <th className="px-4 py-3">Mínimo</th>
                <th className="px-4 py-3" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.productId} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{productNames.get(level.productId) ?? 'Producto eliminado'}</td>
                  <td className={`px-4 py-3 ${level.currentQuantity <= level.minThreshold ? 'text-red-600 font-semibold' : ''}`}>
                    {level.currentQuantity}
                  </td>
                  <td className="px-4 py-3">{level.reservedQuantity}</td>
                  <td className="px-4 py-3">{level.minThreshold}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setPanel({ productId: level.productId, mode: 'in' })}>Ingresar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setPanel({ productId: level.productId, mode: 'out' })}>Egresar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setPanel({ productId: level.productId, mode: 'movements' })}>
                        Movimientos
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panel && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {PANEL_TITLES[panel.mode]}: {productNames.get(panel.productId) ?? 'Producto'}
            </h3>
            {panel.mode === 'movements' && (
              <Button variant="ghost" size="sm" onClick={() => setPanel(null)}>Cerrar</Button>
            )}
          </div>
          {panel.mode === 'movements' ? (
            <MovementsList businessId={businessId} productId={panel.productId} />
          ) : (
            <StockChangeForm
              key={`${panel.productId}-${panel.mode}`}
              mode={panel.mode}
              onSubmit={handleStockChange}
              onCancel={() => setPanel(null)}
            />
          )}
        </div>
      )}

      <form onSubmit={handleInitialize} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Inicializar stock</h3>
        {productsWithoutLevel.length === 0 ? (
          <p className="text-sm text-gray-500">Todos tus productos ya tienen stock inicializado.</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                id="stock-init-product"
                label="Producto sin stock"
                placeholder="Elegí un producto"
                value={initProductId}
                onChange={(e) => setInitProductId(e.target.value)}
                options={productsWithoutLevel.map((product) => ({ value: product.id, label: product.name }))}
              />
              <Input
                id="stock-init-quantity"
                label="Cantidad inicial"
                inputMode="decimal"
                value={initQuantity}
                onChange={(e) => setInitQuantity(e.target.value)}
              />
              <Input
                id="stock-init-min"
                label="Stock mínimo"
                inputMode="decimal"
                value={initMinThreshold}
                onChange={(e) => setInitMinThreshold(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={initializing}>Inicializar</Button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { CashSession, Category, IvaCondition, ModifierGroup, Product, TopSeller } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import { MAX_FAVORITES, selectFavorites } from './FavoritesStrip';
import type { PosSucursal } from './PosSetup';

export interface PosBusiness {
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

/** Top sellers fill the favorites strip from the paid orders of the last week (S13). */
const TOP_SELLERS_QUERY = { days: 7, limit: MAX_FAVORITES };

export const mainSucursalId = (sucursales: PosSucursal[]) => (sucursales.find((s) => s.isMain) ?? sucursales[0])?.id ?? '';

interface Options {
  sucursalId: string;
  setSucursalId: (sucursalId: string) => void;
  setError: (message: string | null) => void;
}

/** Business, catalog and favorites the POS sells from, plus the caja of the selected sucursal. */
export function usePosBusiness({ sucursalId, setSucursalId, setError }: Options) {
  const router = useRouter();
  const [business, setBusiness] = useState<PosBusiness | null>(null);
  const [sucursales, setSucursales] = useState<PosSucursal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cash, setCash] = useState<CashState | null>(null);

  const favorites = useMemo(() => selectFavorites(products, topSellers), [products, topSellers]);

  const loadData = useCallback(async () => {
    try {
      if (!localStorage.getItem('auth_token')) {
        router.push('/login');
        return;
      }

      const businesses: PosBusiness[] = await api.getBusinesses();
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
  }, [router, setSucursalId, setError]);

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
  }, [business, sucursalId, cash, setError]);

  // While the caja of the sucursal is loading nothing can be sold either, but there is no banner yet.
  const cashKnown = !!cash && cash.sucursalId === sucursalId;
  const cashOpen = cashKnown && !!cash.session;

  return { business, sucursales, categories, products, modifierGroups, favorites, isLoading, cashKnown, cashOpen };
}

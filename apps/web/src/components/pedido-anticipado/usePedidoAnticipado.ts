import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { PedidoAnticipadoSucursal } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';

/** Pedido anticipado of each sucursal of the business: enable, disable and its public link (S20). */
export function usePedidoAnticipado() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [sucursales, setSucursales] = useState<PedidoAnticipadoSucursal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!localStorage.getItem('auth_token')) {
        router.push('/login');
        return;
      }
      const businesses: { id: string }[] = await api.getBusinesses();
      if (businesses.length === 0) {
        setError('No se encontró ningún negocio asociado');
        return;
      }
      setBusinessId(businesses[0].id);
      setSucursales((await api.getPedidoAnticipado(businesses[0].id)).sucursales);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cargar el pedido anticipado'));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (sucursalId: string, change: Partial<PedidoAnticipadoSucursal>) =>
    setSucursales((current) => current.map((s) => (s.sucursalId === sucursalId ? { ...s, ...change } : s)));

  const run = async (task: (id: string) => Promise<void>, fallback: string) => {
    if (!businessId) return;
    setBusy(true);
    setError(null);
    try {
      await task(businessId);
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const enable = (sucursalId: string) =>
    run(async (id) => {
      const { url } = await api.enablePedidoAnticipado(id, sucursalId);
      update(sucursalId, { enabled: true, url });
    }, 'No se pudo activar el pedido anticipado');

  const disable = (sucursal: PedidoAnticipadoSucursal) => {
    if (!confirm(`¿Desactivar el pedido anticipado de ${sucursal.name}? El link y el QR impreso dejan de funcionar hasta que lo vuelvas a activar.`)) return;
    run(async (id) => {
      await api.disablePedidoAnticipado(id, sucursal.sucursalId);
      update(sucursal.sucursalId, { enabled: false, url: null });
    }, 'No se pudo desactivar el pedido anticipado');
  };

  return { sucursales, isLoading, error, busy, enable, disable };
}

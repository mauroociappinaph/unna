import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { MercadoPagoStatus } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import { redirectTo } from '@/lib/navigation';

/** Mercado Pago account of the business and the QR cash register of each sucursal (S15). */
export function useMercadoPago() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [status, setStatus] = useState<MercadoPagoStatus | null>(null);
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
      setStatus(await api.getMercadoPagoStatus(businesses[0].id));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cargar Mercado Pago'));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

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

  const connect = () =>
    run(async (id) => {
      const { authorizationUrl } = await api.connectMercadoPago(id);
      redirectTo(authorizationUrl);
    }, 'No se pudo conectar con Mercado Pago');

  const disconnect = () => {
    if (!confirm('¿Desconectar la cuenta de Mercado Pago? No vas a poder cobrar con QR hasta que la vuelvas a conectar.')) return;
    run(async (id) => {
      await api.disconnectMercadoPago(id);
      // Disconnecting also unlinks the cash registers of every sucursal.
      setStatus((current) => current && {
        connected: false,
        mpUserId: null,
        liveMode: null,
        connectedAt: null,
        sucursales: current.sucursales.map((s) => ({ ...s, ready: false, qrImageUrl: null, qrTemplateUrl: null })),
      });
    }, 'No se pudo desconectar Mercado Pago');
  };

  const provision = (sucursalId: string) =>
    run(async (id) => {
      const pos = await api.provisionMercadoPagoPos(id, sucursalId);
      setStatus((current) => current && {
        ...current,
        sucursales: current.sucursales.map((s) => (s.sucursalId === sucursalId ? { ...s, ...pos } : s)),
      });
    }, 'No se pudo activar el cobro QR');

  return { status, isLoading, error, busy, connect, disconnect, provision };
}

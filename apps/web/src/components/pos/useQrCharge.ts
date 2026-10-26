import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { QrCharge } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import { startVisiblePolling } from '@/lib/visible-polling';

/** The POS asks the API (which syncs with Mercado Pago) for the charge status this often. */
export const QR_POLL_INTERVAL_MS = 3000;

interface Options {
  businessId: string | undefined;
  orderId: string;
  onPaid: () => void;
}

/** Mercado Pago QR charge of the pending balance of an order, polled until it is paid, expired or cancelled (S15). */
export function useQrCharge({ businessId, orderId, onPaid }: Options) {
  const [charge, setCharge] = useState<QrCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Latest callback without restarting the polling when the parent re-renders.
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const chargeId = charge?.id;
  const pending = charge?.status === 'pending';

  useEffect(() => {
    if (!businessId || !chargeId || !pending) return;
    let active = true;
    // Paused while the tab is hidden; checks the charge at once when it is visible again (S17).
    const stop = startVisiblePolling(
      async () => {
        try {
          const next = await api.getQrCharge(businessId, chargeId);
          if (!active) return;
          setCharge(next);
          if (next.status === 'paid') onPaidRef.current();
        } catch (err) {
          if (active) setError(apiErrorMessage(err, 'No se pudo consultar el cobro QR'));
        }
      },
      QR_POLL_INTERVAL_MS,
      { immediate: false },
    );
    return () => {
      active = false;
      stop();
    };
  }, [businessId, chargeId, pending]);

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

  const start = () =>
    run(async (id) => {
      const created = await api.createQrCharge(id, orderId);
      setCharge(created);
      if (created.status === 'paid') onPaidRef.current();
    }, 'No se pudo generar el QR');

  const cancel = () => {
    if (!chargeId) return;
    run(async (id) => {
      await api.cancelQrCharge(id, chargeId);
      setCharge(null);
    }, 'No se pudo cancelar el cobro QR');
  };

  const simulatePayment = () => {
    if (!chargeId) return;
    run(async (id) => {
      const paid = await api.simulateQrPayment(id, chargeId);
      setCharge(paid);
      if (paid.status === 'paid') onPaidRef.current();
    }, 'No se pudo simular el pago');
  };

  return { charge, error, busy, start, cancel, simulatePayment };
}

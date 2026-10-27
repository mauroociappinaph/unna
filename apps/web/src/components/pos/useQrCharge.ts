import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { QrCharge } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import { startVisiblePolling } from '@/lib/visible-polling';

/** The POS asks the API (which syncs with Mercado Pago) for the charge status this often. */
export const QR_POLL_INTERVAL_MS = 3000;
/** A charge without a QR after this long is given up so the cashier can try again (S21). */
export const QR_CREATING_TIMEOUT_MS = 30000;

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
  // A charge still being created is polled like a pending one until its QR arrives (S18).
  const pending = charge?.status === 'pending' || charge?.status === 'creating';
  // No QR to show yet: Mercado Pago has not answered (S21).
  const awaitingQr = pending && !charge?.qrData;

  useEffect(() => {
    if (!businessId || !chargeId || !pending) return;
    let active = true;
    // Paused while the tab is hidden; checks the charge at once when it is visible again (S17).
    const stop = startVisiblePolling(
      async () => {
        try {
          const next = await api.getQrCharge(businessId, chargeId);
          if (!active) return;
          // A charge dropped meanwhile (cancelled locally or given up) stays dropped (S21).
          setCharge((current) => (current?.id === next.id ? next : current));
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

  useEffect(() => {
    if (!chargeId || !awaitingQr) return;
    const timer = setTimeout(() => {
      setCharge(null);
      setError('No se pudo generar el QR. Probá de nuevo.');
    }, QR_CREATING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [chargeId, awaitingQr]);

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
    // Without a QR there is nothing the customer can pay yet: drop it here and stop polling (S21).
    if (awaitingQr) {
      setCharge(null);
      setError(null);
      return;
    }
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/api-types';
import { QrCode } from './QrCode';
import { useQrCharge } from './useQrCharge';

/** Errors the owner fixes in the Mercado Pago settings. */
const SETTINGS_ERRORS = ['Conectá tu cuenta de Mercado Pago', 'Activá el cobro QR en esta sucursal'];

interface QrChargePanelProps {
  businessId: string | undefined;
  orderId: string;
  remaining: number;
  disabled: boolean;
  onPaid: () => void;
}

/** Seconds left until the ISO date, refreshed every second while active. */
function useSecondsLeft(expiresAt: string | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, active]);

  return expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)) : 0;
}

const formatCountdown = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** "Cobrar con QR": Mercado Pago QR on screen for the pending balance (S15). */
export function QrChargePanel({ businessId, orderId, remaining, disabled, onPaid }: QrChargePanelProps) {
  const { charge, error, busy, start, cancel } = useQrCharge({ businessId, orderId, onPaid });
  const pending = charge?.status === 'pending';
  const secondsLeft = useSecondsLeft(charge?.expiresAt, pending);

  if (!charge && remaining <= 0) return null;

  return (
    <section aria-labelledby="qr-charge-title" className="border border-gray-100 rounded-xl p-4 space-y-3">
      <h3 id="qr-charge-title" className="font-semibold text-gray-900">Cobro con QR</h3>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm space-y-1">
          <p>{error}</p>
          {SETTINGS_ERRORS.includes(error) && (
            <Link href="/dashboard/mercadopago" className="font-semibold underline">Ir a Mercado Pago</Link>
          )}
        </div>
      )}

      {!charge && (
        <Button variant="secondary" disabled={busy || disabled} onClick={start}>Cobrar con QR</Button>
      )}

      {charge && pending && (
        <div className="flex flex-col items-center gap-2 text-center">
          <QrCode data={charge.qrData} label="QR de Mercado Pago para pagar el pedido" />
          <p className="text-2xl font-bold text-gray-900">{formatMoney(charge.amount)}</p>
          <p className="text-sm text-gray-600">Vence en {formatCountdown(secondsLeft)}</p>
          <p className="text-sm text-gray-600">
            Mostrale este QR al cliente; también puede escanear el QR impreso de la caja.
          </p>
          <Button variant="outline" size="sm" disabled={busy} onClick={cancel}>Cancelar</Button>
        </div>
      )}

      {charge?.status === 'paid' && (
        <p role="status" className="font-semibold text-unna-green-dark">Pago recibido</p>
      )}

      {charge && (charge.status === 'expired' || charge.status === 'cancelled') && (
        <div className="space-y-2">
          <p className="text-gray-700">{charge.status === 'expired' ? 'El QR venció' : 'El cobro QR se canceló'}</p>
          {remaining > 0 && (
            <Button variant="secondary" size="sm" disabled={busy || disabled} onClick={start}>Generar otro QR</Button>
          )}
        </div>
      )}
    </section>
  );
}

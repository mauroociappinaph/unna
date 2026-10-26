'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ErrorBanner } from '@/components/catalog/ErrorBanner';
import { MercadoPagoAccount } from '@/components/mercadopago/MercadoPagoAccount';
import { SucursalQrCard } from '@/components/mercadopago/SucursalQrCard';
import { useMercadoPago } from '@/components/mercadopago/useMercadoPago';
import { PosHeader } from '@/components/pos/PosHeader';

/** Result of the OAuth flow: the API callback redirects back with ?status=connected|error. */
function OAuthResult() {
  const status = useSearchParams().get('status');
  if (status === 'connected') {
    return (
      <div role="status" className="bg-green-50 border border-green-200 rounded-xl p-4 text-unna-green-dark">
        Tu cuenta de Mercado Pago quedó conectada.
      </div>
    );
  }
  if (status === 'error') return <ErrorBanner message="No se pudo conectar tu cuenta de Mercado Pago. Probá de nuevo." />;
  return null;
}

export default function MercadoPagoPage() {
  const { status, isLoading, error, busy, connect, disconnect, provision } = useMercadoPago();

  return (
    <div className="min-h-screen bg-gray-50">
      <PosHeader />

      <main className="container-custom py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mercado Pago</h1>
            <p className="text-gray-600">Conectá tu cuenta y activá el cobro con QR en cada sucursal</p>
          </div>

          <Suspense fallback={null}>
            <OAuthResult />
          </Suspense>
          <ErrorBanner message={error} />

          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-unna-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {status && (
            <MercadoPagoAccount status={status} busy={busy} onConnect={connect} onDisconnect={disconnect} />
          )}

          {status?.connected && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Cobro con QR por sucursal</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {status.sucursales.map((sucursal) => (
                  <SucursalQrCard key={sucursal.sucursalId} sucursal={sucursal} busy={busy} onProvision={provision} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

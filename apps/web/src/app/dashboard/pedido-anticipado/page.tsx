'use client';

import { ErrorBanner } from '@/components/catalog/ErrorBanner';
import { PedidoSucursalCard } from '@/components/pedido-anticipado/PedidoSucursalCard';
import { usePedidoAnticipado } from '@/components/pedido-anticipado/usePedidoAnticipado';
import { PosHeader } from '@/components/pos/PosHeader';

export default function PedidoAnticipadoPage() {
  const { sucursales, isLoading, error, busy, enable, disable } = usePedidoAnticipado();

  return (
    <div className="min-h-screen bg-gray-50">
      <PosHeader />

      <main className="container-custom py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pedido anticipado</h1>
            <p className="text-gray-600">
              Activá el link de cada sucursal: tus clientes piden, pagan con Mercado Pago y el pedido entra a la barra. Solo se reciben pedidos con el
              local abierto y la caja abierta.
            </p>
          </div>

          <ErrorBanner message={error} />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-unna-green border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {sucursales.map((sucursal) => (
                <PedidoSucursalCard key={sucursal.sucursalId} sucursal={sucursal} busy={busy} onEnable={enable} onDisable={disable} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { Button } from '@/components/ui/Button';
import type { MercadoPagoStatus } from '@/lib/api-types';

interface MercadoPagoAccountProps {
  status: MercadoPagoStatus;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

/** Connection state of the Mercado Pago account of the café. */
export function MercadoPagoAccount({ status, busy, onConnect, onDisconnect }: MercadoPagoAccountProps) {
  if (!status.connected) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <p className="text-gray-600">
          Conectá la cuenta de Mercado Pago de tu café para cobrar con QR. Los pagos se acreditan directo en tu cuenta.
        </p>
        <Button disabled={busy} onClick={onConnect}>Conectar con Mercado Pago</Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-unna-green-dark">Cuenta conectada</p>
        <p className="text-sm text-gray-600">
          {status.mpUserId && `Usuario ${status.mpUserId}`}
          {status.connectedAt && ` · desde el ${formatDate(status.connectedAt)}`}
          {status.liveMode === false && ' · modo de prueba'}
        </p>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={onDisconnect}>Desconectar</Button>
    </div>
  );
}

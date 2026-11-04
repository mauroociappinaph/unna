import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import type { MercadoPagoStatus } from '@/lib/api-types';

interface SucursalQrCardProps {
  sucursal: MercadoPagoStatus['sucursales'][number];
  busy: boolean;
  onProvision: (sucursalId: string) => void;
}

/** Cash register of a sucursal in Mercado Pago and its printed static QR. */
export function SucursalQrCard({ sucursal, busy, onProvision }: SucursalQrCardProps) {
  const headingId = `mp-sucursal-${sucursal.sucursalId}`;

  return (
    <section aria-labelledby={headingId} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h3 id={headingId} className="text-lg font-semibold text-gray-900">{sucursal.name}</h3>
      {sucursal.ready ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Imprimí este QR y dejalo en la caja: tus clientes lo escanean con la app de Mercado Pago.
          </p>
          {sucursal.qrImageUrl && (
            <Image
              src={sucursal.qrImageUrl}
              alt={`QR impreso de ${sucursal.name}`}
              width={192}
              height={192}
              unoptimized
              className="w-48 h-48 border border-gray-100 rounded-xl"
            />
          )}
          {sucursal.qrTemplateUrl && (
            <a
              href={sucursal.qrTemplateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-unna-green-dark underline"
            >
              Descargar para imprimir
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Creá la caja de esta sucursal en Mercado Pago para cobrar con QR.</p>
          <Button size="sm" disabled={busy} onClick={() => onProvision(sucursal.sucursalId)}>
            Activar cobro QR
          </Button>
        </div>
      )}
    </section>
  );
}
